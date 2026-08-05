# Plano de Ação Técnico — Fase 2 (Migrations, Master Data V0 e Mobile)

**Escopo:** preparar o banco de dados, popular os dados mestres e colocar o
app mobile (Expo) testando o login por PIN contra a API em produção local.

---

## 1. Execução de Migrations e Estrutura de Dados

### 1.1 Pré-requisitos

- Docker Desktop rodando.
- `.env` na raiz do projeto preenchido (já existe; confira `POSTGRES_PASSWORD`
  e, se quiser, troque `JWT_SECRET` por um valor forte antes de subir).
- Nenhum container com dados antigos que você queira preservar (o volume
  `db-data` é criado no primeiro `up`).

### 1.2 Subir os serviços e aguardar o Postgres ficar saudável

```powershell
cd C:\Codigos\SliptConter
docker compose up -d --build db api
docker compose ps
```

Aguarde até `tebarrot-db` aparecer como `healthy` (o healthcheck roda
`pg_isready`). Só então execute as migrations.

### 1.3 Executar o runner de migrations (recomendado: dentro do container)

Rodar de dentro do container `api` garante que `POSTGRES_HOST=db` e
`POSTGRES_PORT=5432` (rede Docker interna) sejam usados corretamente:

```powershell
docker compose exec api npm run migrate
```

O runner (`api/migrations/run.js`) aplica, em ordem, os arquivos
`001_*.sql` … `007_seed_produtos.sql` e registra cada um em
`schema_migrations`, então é **idempotente** — rodar de novo não duplica nada.

### 1.4 Alternativa: rodar o runner a partir do host

Se preferir rodar fora do Docker, aponte para a porta publicada no host
(5433, já que a 5432 está ocupada na sua máquina):

```powershell
cd C:\Codigos\SliptConter\api
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_PORT="5433"
node migrations/run.js
```

### 1.5 Alternativa: aplicar o DDL completo direto no Postgres

Útil para inspeção/auditoria do schema (não é o caminho padrão):

```powershell
docker compose exec -T db psql -U tebarrot -d tebarrot_estoque -f /migrations/001_create_extensions.sql
# ... ou o DDL consolidado:
docker compose exec -T db psql -U tebarrot -d tebarrot_estoque < docs/schema.sql
```

> Nota: `docs/schema.sql` é a referência consolidada do schema; o runner de
> migrations é a fonte de verdade operacional (controla versões via
> `schema_migrations`).

### 1.6 Verificação das tabelas

```powershell
docker compose exec db psql -U tebarrot -d tebarrot_estoque -c "\dt"
```

Esperado: `usuarios`, `produtos`, `conferencias`, `movimentacoes_estoque`,
`sheets_sync_queue`, `schema_migrations`.

---

## 2. População de Master Data (V0)

### 2.1 Produtos (via migration 007 — já criada)

`api/migrations/007_seed_produtos.sql` cadastra três produtos reais com a
lógica de `volumes_por_camada`, usando `ON CONFLICT (sku) DO NOTHING` para
ser idempotente:

| SKU | Descrição | volumes_por_camada | camadas_maximas_palete |
|---|---|---|---|
| `AGU-500ML-12` | Água Mineral 500ml - Fardo c/ 12 unidades | 10 | 8 |
| `ARR-5KG-T1` | Arroz Tipo 1 - Saco 5kg | 8 | 10 |
| `FEI-1KG-P` | Feijão Carioca - Saco 1kg | 12 | 8 |

Este seed é aplicado automaticamente pelo `npm run migrate` (passo 1.3).
Para adicionar/ajustar SKUs depois, edite o arquivo e re-rode o runner
(o `ON CONFLICT` impede duplicatas).

### 2.2 Primeiro usuário admin (bootstrap)

O endpoint `POST /api/auth/usuarios` exige um gestor/admin autenticado, então
o primeiro admin é criado direto no banco com PIN hasheado por bcrypt:

```powershell
docker compose exec api node scripts/bootstrap_admin.js
```

Resultado: usuário `Administrador`, crachá `ADMIN-0001`, PIN inicial `1234`
(troque em produção). O script é idempotente.

### 2.3 Criar os operadores do galpão via API (com o admin autenticado)

```powershell
# 1) login do admin (retorna o JWT)
curl -s -X POST https://estoque.puratienda.store/api/auth/login/pin `
  -H "Content-Type: application/json" `
  -d '{\"usuarioId\":\"<id_do_admin>\",\"pin\":\"1234\"}'

# 2) com o token, criar um operador
curl -s -X POST https://estoque.puratienda.store/api/auth/usuarios `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <TOKEN>" `
  -d '{\"nome\":\"Operador Teste\",\"pin\":\"2580\",\"papel\":\"operador\"}'
```

> O `usuarioId` do admin pode ser obtido com
> `GET /api/auth/usuarios` (lista id + nome, sem expor o PIN).

---

## 3. Configuração e Integração do Mobile (Expo)

### 3.1 Pré-requisitos

- Node.js >= 18 instalado (você tem v22).
- Opcional para testar no celular físico: app **Expo Go** instalado e celular
  na mesma rede Wi-Fi do PC (ou use um emulador Android Studio / Xcode).

### 3.2 Arquivo `.env` (já criado)

`mobile-app/.env` contém exatamente:

```
EXPO_PUBLIC_API_URL=https://estoque.puratienda.store
```

O `src/services/api.js` lê essa variável (com fallback para
`app.json -> expo.extra.apiUrl`) e monta `baseURL = <URL>/api`.

### 3.3 Instalar dependências

```powershell
cd C:\Codigos\SliptConter\mobile-app
npm install
```

### 3.4 Iniciar o projeto

```powershell
npx expo start
```

- Pressione `a` para abrir no emulador Android, `i` para iOS, ou escaneie o QR
  com o Expo Go no celular.
- Se o Metro não recarregar a variável de ambiente, reinicie com cache limpo:
  `npx expo start --clear`.

### 3.5 Teste de integração: login por PIN contra a API

1. Na tela de login do app, toque em **"Entrar com PIN"**.
2. A lista de nomes é carregada de `GET /api/auth/usuarios` — deve aparecer o
   operador criado no passo 2.3.
3. Selecione o nome e digite o PIN (ex.: `2580`).
4. Sucesso = `POST /api/auth/login/pin` retorna 200 e o app navega para
   `Home`. O token fica persistido no AsyncStorage (sessão fica ativa).
5. Para testar o caminho do crachá depois, gere um QR com o conteúdo
   `codigo_crachao` de um usuário e bipe na tela inicial de login.

### 3.6 Checklist de validação da integração

- [ ] `GET https://estoque.puratienda.store/api/health` retorna `{"status":"ok"}`.
- [ ] `GET /api/auth/usuarios` lista o operador (sem expor `pin_hash`).
- [ ] Login por PIN no app retorna à tela `Home` com o nome do usuário.
- [ ] Bipar um SKU da tabela de produtos leva à tela de captura
  (`GET /api/produtos/sku/:sku` retorna 200).

---

## Ordem de execução recomendada

1. `docker compose up -d --build db api`
2. `docker compose exec api npm run migrate`  (cria tabelas + seed de produtos)
3. `docker compose exec api node scripts/bootstrap_admin.js`
4. Criar operador via API (curl) ou deixar para criar pelo app depois.
5. `cd mobile-app && npm install && npx expo start`
6. Testar login por PIN (passo 3.5).

## Arquivos criados nesta fase

- `api/migrations/007_seed_produtos.sql` — seed de produtos (idempotente).
- `api/scripts/bootstrap_admin.js` — cria o primeiro admin com PIN hasheado.
- `mobile-app/.env` — `EXPO_PUBLIC_API_URL=https://estoque.puratienda.store`.
- `docs/plano_acao_fase2.md` — este documento.
