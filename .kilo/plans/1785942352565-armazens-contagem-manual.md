# Plano: Estoque por Armazém + Contagem Manual Real (substitui modelo de camadas/palete)

## 1. Contexto (por que este plano existe)

Feedback do primeiro teste do app + 2 documentos + 1 fluxograma revelaram 3 coisas:

1. **Causa raiz de "sem informação no banco":** a migration `007_seed_produtos.sql` só tem 3 produtos fictícios de mercado (água, arroz, feijão) — nunca o catálogo real da Tebarrot (móveis). Bipar uma etiqueta real não encontra nada.
2. **A "contagem manual" já existe no código** (`ConferenciaScreen.js`), mas é modelada como `camadas × volumes_por_camada` (regra de pallet de mercadoria homogênea). Isso **não se aplica a móveis** — daí a sensação de que "a contagem manual não está lá": ela está, mas para o produto errado.
3. **Decisão já confirmada com o usuário:** o estoque passa a ser controlado **por Armazém** (múltiplos locais físicos reais, cadastráveis via CRUD — não fixos em "1/2/3"), não mais um saldo global único por produto.

O documento de pesquisa de WMS (endereçamento em 5 níveis, contagem cega com auditor, hardware Zebra/DataWedge, impressão ZPL, YOLOv11) é **benchmarking/inspiração**, não um pedido literal — está fora do escopo deste plano (seção 8).

Como uma pergunta detalhada sobre a semântica exata de "+Add Produto/-Remover Produto" foi descartada pelo usuário, e o pedido seguinte foi "proponha uma solução técnica", este plano assume as decisões abaixo (seção 2) como padrão razoável e as declara explicitamente para poderem ser corrigidas antes da implementação.

## 2. Premissas assumidas (ajustáveis)

| Decisão | Assumido | Alternativa se estiver errado |
|---|---|---|
| "+Add Produto" / "-Remover Produto" | Lançamento manual de quantidade (entrada/saída) de um produto do catálogo em um armazém — **esta é a "contagem manual"** que faltava | Poderia ser só vínculo produto↔armazém sem quantidade |
| Unidade de contagem | Quantidade direta por unidade/kit (sem "camadas") | Poderia precisar validar kit completo (N caixas) antes de contar como 1 unidade |
| Foto por lançamento | Opcional (evidência + dataset futuro), não obrigatória | Poderia ser obrigatória por auditoria |
| Transferência entre armazéns | Não implementada agora — fica como 2 lançamentos manuais (saída origem + entrada destino) | Poderia precisar de 1 operação atômica dedicada |
| IA (YOLOv11) | Fora desta fase — não há dataset ainda (seção 8) | — |
| Catálogo real | Precisa ser cadastrado (tela nova ou import de planilha, se houver uma) | — |

## 3. Fora de escopo (explícito)

Do documento de pesquisa de WMS, **não entram** neste plano:
- Endereçamento físico em 5 níveis (Rua/Módulo/Nível/Vão) — só "Armazém" como unidade.
- Contagem cega com auditor dedicado + motor de reconciliação/recontagem.
- Integração com coletores Zebra/DataWedge e impressão térmica ZPL.
- Paginação por cursor na API (volume atual não justifica).
- Reconhecimento visual multi-produto por foto (YOLOv11) — ver caminho futuro na seção 8.

## 4. Modelo de dados

### 4.1 Nova tabela `armazens`

```sql
-- 009_create_armazens.sql
BEGIN;

CREATE TABLE IF NOT EXISTS armazens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        VARCHAR(120) NOT NULL,
    codigo      VARCHAR(30) UNIQUE,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_armazens_ativo ON armazens (ativo);

-- Armazém padrão, necessário para o backfill das tabelas existentes na próxima migration.
INSERT INTO armazens (nome, codigo) VALUES ('Galpão Principal', 'PRINCIPAL')
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
```

### 4.2 Propagar `armazem_id` para o ledger e conferências

```sql
-- 010_add_armazem_a_estoque.sql
BEGIN;

ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS armazem_id UUID REFERENCES armazens (id);
ALTER TABLE conferencias        ADD COLUMN IF NOT EXISTS armazem_id UUID REFERENCES armazens (id);

UPDATE movimentacoes_estoque SET armazem_id = (SELECT id FROM armazens WHERE codigo = 'PRINCIPAL') WHERE armazem_id IS NULL;
UPDATE conferencias        SET armazem_id = (SELECT id FROM armazens WHERE codigo = 'PRINCIPAL') WHERE armazem_id IS NULL;

ALTER TABLE movimentacoes_estoque ALTER COLUMN armazem_id SET NOT NULL;
ALTER TABLE conferencias        ALTER COLUMN armazem_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_armazem ON movimentacoes_estoque (armazem_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_armazem ON movimentacoes_estoque (produto_id, armazem_id);
CREATE INDEX IF NOT EXISTS idx_conferencias_armazem ON conferencias (armazem_id);

COMMIT;
```

**Saldo passa a ser:** `SUM(quantidade) FROM movimentacoes_estoque WHERE produto_id = X AND armazem_id = Y`.

### 4.3 Generalizar contagem (remover dependência de camadas/palete)

```sql
-- 011_generalizar_contagem.sql
BEGIN;

-- produtos: modelo de camadas/palete deixa de ser obrigatório (não se aplica a móveis).
ALTER TABLE produtos ALTER COLUMN volumes_por_camada DROP NOT NULL;
-- ATENÇÃO: confirme o nome real da constraint com `\d produtos` antes de rodar
-- (Postgres nomeia CHECKs automaticamente; o nome abaixo é o padrão esperado).
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_volumes_por_camada_check;
ALTER TABLE produtos ADD CONSTRAINT produtos_volumes_por_camada_check
    CHECK (volumes_por_camada IS NULL OR volumes_por_camada > 0);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS quantidade_volumes INTEGER
    CHECK (quantidade_volumes IS NULL OR quantidade_volumes > 0); -- nº de caixas/kit (informativo, não usado no cálculo ainda)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria VARCHAR(60);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url  VARCHAR(500);

-- conferencias: "camadas" generalizado para "quantidade contada" (contagem direta);
-- foto passa a ser opcional.
ALTER TABLE conferencias RENAME COLUMN camadas_informadas   TO quantidade_contada;
ALTER TABLE conferencias RENAME COLUMN camadas_sugeridas_ia TO quantidade_sugerida_ia;
ALTER TABLE conferencias ALTER COLUMN url_imagem_local DROP NOT NULL;

COMMIT;
```

### 4.4 Desativar catálogo fictício

```sql
-- 012_desativar_seed_ficticio.sql
BEGIN;
UPDATE produtos SET ativo = FALSE WHERE sku IN ('AGU-500ML-12', 'ARR-5KG-T1', 'FEI-1KG-P');
COMMIT;
```

## 5. Backend (`api/`)

### 5.1 Novo módulo `armazens`
- `src/models/Armazem.js` — `findById`, `list({ativo})`, `create({nome, codigo})`, `update(id, {nome, codigo, ativo})` (mesmo padrão de `Produto.js`).
- `src/controllers/armazensController.js` — `listar` (GET, autenticado), `criar`/`atualizar` (restrito a `exigirPapel('gestor','admin')`), e `estoque(req,res)`:
  - `GET /api/armazens/:id/estoque` → todos os produtos `ativo=true`, cada um com o saldo **naquele armazém** (0 se nunca houve movimentação) — `SELECT p.*, COALESCE(SUM(m.quantidade),0) AS saldo FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id AND m.armazem_id=$1 WHERE p.ativo GROUP BY p.id ORDER BY p.descricao`.
- `src/routes/armazensRoutes.js` — registrar em `src/routes/index.js` como `router.use('/armazens', armazensRoutes)`.

### 5.2 `produtosController` / `Produto.js`
- `criar`: `sku` e `descricao` obrigatórios; `volumesPorCamada`, `camadasMaximasPalete`, `quantidadeVolumes`, `categoria`, `fotoUrl` todos opcionais.
- `Produto.saldo` (endpoint `GET /:id/saldo`): aceitar `?armazemId=`.
  - Com `armazemId`: `{ produtoId, sku, armazemId, saldo }`.
  - Sem: `{ produtoId, sku, saldoTotal, porArmazem: [{ armazemId, nome, saldo }] }`.

### 5.3 `conferenciasController` / `conferenciaService` / `Conferencia.js`
- Body passa a exigir `armazemId`. Campo `camadasInformadas` → `quantidadeContada`.
- `imagem` (multer) deixa de ser obrigatória: remover o `if (!req.file) return res.status(400)...` em `conferenciasController.criar`; `caminhoRelativo` só é chamado quando `req.file` existir (senão `urlImagemLocal = null`).
- `conferenciaService.registrarConferencia`: `quantidadeTotal = quantidadeContada + ajusteManual` (sem multiplicação por `volumes_por_camada`).
- `Conferencia.create`: usar os novos nomes de coluna (`quantidade_contada`, `quantidade_sugerida_ia`) e incluir `armazem_id`.

### 5.4 `ledgerService` / `MovimentacaoEstoque.js`
- `create()` passa a receber `armazemId` obrigatório.
- `saldoPorProduto(produtoId, armazemId?)`: se `armazemId` informado, filtra; adicionar `saldoAgrupadoPorArmazem(produtoId)` (retorna array agrupado por armazém, para o endpoint 5.2).
- Novo `list({produtoId?, armazemId?, limit, offset})` + controller `listar` + rota `GET /api/movimentacoes` (hoje só existe `GET /:id`) — alimenta o Dashboard (seção 6).

### 5.5 `sheetsSyncService.js`
- `HEADERS` ganha coluna `armazem`; chave de linha existente passa a ser `(sku, armazem)` em vez de só `sku`; `atualizarLinhaDoProduto` precisa do `armazemId` da movimentação (já disponível via `movimentacao.armazem_id`) e usar `ledgerService.saldoPorProduto(produtoId, armazemId)`.

## 6. Mobile app (`mobile-app/`)

### 6.1 Navegação (`src/App.js`)
Rota inicial pós-login passa de `Home` para `Armazens`. Novo stack:
`Login → Armazens → ArmazemDetail → LancarContagem`, mais `ProdutoForm`, `ArmazemForm`, `Dashboard`, `SyncStatus` (mantido).

### 6.2 Telas novas/alteradas

| Tela | Ação | Substitui |
|---|---|---|
| `ArmazensScreen.js` | Lista armazéns (cards); botão "+ Novo Armazém" (gestor/admin); atalhos Dashboard/Sincronização/Sair | `HomeScreen.js` |
| `ArmazemDetailScreen.js` (novo) | Lista produtos ativos + saldo **deste** armazém (`GET /armazens/:id/estoque`); busca por nome; botão "+ Lançar contagem"; botão "+ Cadastrar produto" (gestor/admin) | — |
| `LancarContagemScreen.js` | 1) escolher produto (busca por nome/SKU **ou** bipar código de barras — reaproveita o `CameraView` de `HomeScreen.js` atual); se não achar, atalho "Cadastrar agora" → `ProdutoForm`. 2) tipo (Entrada/Saída/Ajuste, segmented, default Entrada) + quantidade (`CounterStepper` existente) + foto opcional (reaproveita `CapturaScreen`/`OverlayGuide` como sub-fluxo). 3) Confirmar → `api.criarConferencia` com fallback offline igual ao atual | `ConferenciaScreen.js` (a lógica de confirmar/offline é ~reaproveitável; remove o efeito de sugestão de IA no mount e a matemática de camadas) |
| `ProdutoFormScreen.js` (novo, gestor/admin) | Criar/editar produto: nome, sku (opcional — gerar automático se não houver etiqueta), categoria, foto (câmera ou galeria), quantidade_volumes (opcional) | — |
| `ArmazemFormScreen.js` (novo, gestor/admin) | Criar/editar armazém: nome, código opcional | — |
| `DashboardScreen.js` (novo) | Totais (produtos ativos, armazéns ativos), lista "sem estoque" (saldo total = 0), feed das últimas movimentações (`GET /api/movimentacoes`) | — |
| `CapturaScreen.js`, `OverlayGuide.js`, `CounterStepper.js`, `PrimaryButton.js`, `LoginScreen.js` | Sem mudança de lógica | — |
| `SyncStatusScreen.js` | Trocar `item.camadas_informadas` (linha 57) por `item.quantidade_contada` | — |

### 6.3 Serviços
- `src/services/api.js`: adicionar `listarArmazens`, `criarArmazem`, `buscarEstoqueArmazem(armazemId)`, `criarProduto`, `atualizarProduto`, `listarMovimentacoes(filtros)`; em `criarConferencia`, renomear campos do `FormData` (`armazemId`, `quantidadeContada`) e só anexar `imagem` se `imagemUri` existir.
- `src/services/localDb.js`: tabela `fila_conferencias` ganha coluna `armazem_id`; renomear `camadas_informadas`→`quantidade_contada`, `camadas_sugeridas_ia`→`quantidade_sugerida_ia` (sem dados reais em produção ainda — pode recriar a tabela local em vez de migrar).
- `src/services/syncQueue.js`: atualizar os nomes de campo no `api.criarConferencia(...)` dentro de `flushQueue`.

### 6.4 Nova dependência
- `expo-image-picker` (SDK 54, mesma família do `expo-camera` já usado) — necessário só para "escolher foto da galeria" em `ProdutoFormScreen`. Nenhuma outra dependência nova é necessária; o resto reaproveita `axios`, `expo-camera`, `expo-sqlite`, `@react-navigation/*` já presentes.

## 7. Dados mestres reais

1. Cadastrar o catálogo real da Tebarrot (nome, SKU/código de barras se existir, categoria, foto) via `ProdutoFormScreen`.
   - **Se existir uma planilha/CSV com o catálogo atual**, criar `api/scripts/import_produtos.js` (upsert em massa por SKU, mesmo padrão do `bootstrap_admin.js`) em vez de digitar item por item — confirmar com o usuário se essa planilha existe antes de construir o script.
2. Cadastrar ao menos os armazéns reais (o padrão "Galpão Principal" criado pela migration serve como primeiro, renomeável).
3. Confirmar que a migration 012 desativou os 3 produtos fictícios.

## 8. Caminho para IA (YOLOv11) — fase futura, não incluída agora

Resposta às 3 perguntas originais do usuário:

- **Melhor forma de contabilizar estoque:** ledger imutável (já existente, mantido) + saldo = `SUM(movimentações)` por produto **e armazém**; contagem = lançamento direto de quantidade, sem "camadas" (não se aplica a móveis).
- **Como aproveitar YOLOv11:** ainda não há dataset rotulado. Cada lançamento manual com foto anexada (seção 6.2) já vira, de graça, um exemplo rotulado (foto + produto + quantidade confirmados pelo operador). Quando houver volume suficiente, treinar um modelo YOLOv11 multi-classe (1 classe por SKU/linha) reaproveitando a infraestrutura `ia-worker` já existente (mesma flag `IA_WORKER_ENABLED`, mesmo padrão de fallback gracioso — ver `iaClient.js`). O resultado só pré-preenche sugestões; o operador sempre confirma/ajusta antes de gravar no ledger (mesmo padrão `origem: 'manual'|'ia'` que já existe em `conferencias`).
- **Esquema com item, quantidade e armazém:** seção 4 (tabela `armazens` + `armazem_id` propagado ao ledger e às conferências).

## 9. Tecnologias

Stack atual (Node/Express + `pg` sem ORM, PostgreSQL, Expo/React Native 0.81, SQLite local, JWT) já é adequada para "simples e funcional" — **não recomendo troca de stack**. Única adição: `expo-image-picker` (seção 6.4). Nenhum novo serviço de infraestrutura é necessário (sem mudanças no `docker-compose.yml`).

## 10. Ordem de implementação

1. Migrations 009 → 012 (seção 4), validar com `\dt` e `\d produtos`/`\d conferencias`.
2. Backend: models → services → controllers/routes (seção 5).
3. Cadastrar dados mestres reais (seção 7) — pelo menos alguns produtos e armazéns reais para testar.
4. Mobile: services (`api.js`, `localDb.js`, `syncQueue.js`) → telas (seção 6.2) → `App.js`.
5. Validação (seção 11).

## 11. Validação

- Migrations aplicam sem erro em banco com os dados de teste atuais (3 produtos fictícios + qualquer conferência/movimentação já criada); saldo antigo é preservado sob o armazém "Galpão Principal".
- Criar 2 armazéns reais + 3 produtos reais; lançar entradas/saídas distintas para o mesmo produto em armazéns diferentes; `GET /produtos/:id/saldo` mostra `porArmazem` correto e `saldoTotal` = soma.
- `GET /armazens/:id/estoque` lista produtos com saldo 0 quando nunca houve movimentação ali (resolve a reclamação original de "produto não cadastrado").
- Lançar contagem sem foto → sucesso (imagem realmente opcional).
- Testar fluxo offline: sem rede, lançar contagem → fila local; reconectar → sincroniza e reflete no saldo.
- Papel `operador` consegue lançar contagem mas recebe 403 em `POST /produtos`, `POST /armazens`, `PATCH` de ambos; UI esconde os botões de cadastro para esse papel.
- Login (username/senha) continua funcionando sem alteração.
- Dashboard: soma manual das movimentações confere com os totais exibidos.

## 12. Riscos / pontos de atenção

- Nome real da constraint CHECK em `produtos.volumes_por_camada` (seção 4.3) precisa ser confirmado no banco antes de rodar o `DROP CONSTRAINT` — pode ter nome diferente do assumido.
- Renomear colunas de `conferencias` exige atualizar **todos** os pontos que hoje leem `camadas_informadas`/`camadas_sugeridas_ia`: `Conferencia.js`, `conferenciaService.js`, `conferenciasController.js`, e no mobile `api.js`, `localDb.js`, `syncQueue.js`, `SyncStatusScreen.js` — checklist em 6.2/6.3 cobre todos os pontos encontrados na varredura do código atual.
- `sheetsSyncService.js` muda a chave de identidade da planilha (de `sku` para `sku`+`armazem`) — linhas antigas da aba "Estoque" ficam órfãs; considerar limpar a aba manualmente após o deploy.
- Transferência entre armazéns via 2 lançamentos manuais (seção 2) não é atômica — se o segundo lançamento falhar, fica um "buraco" temporário no saldo total. Aceitável para o escopo atual; revisitar se transferências forem frequentes.
