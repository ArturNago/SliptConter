# Documentação Técnica Final: App de Conferência de Estoque
## Infraestrutura Local + Acesso Mobile Remoto — Tebarrot

**Versão 3 — Final para início de desenvolvimento**

---

## 1. Visão Geral

Sistema de conferência e controle de estoque via Visão Computacional, rodando **100% em infraestrutura local** (sem custos de nuvem, sem domínio próprio), com **acesso mobile remoto seguro** para os operadores do galpão.

O PostgreSQL local é a **fonte única da verdade**. O Google Sheets funciona como **espelho de leitura** para a gestão, sincronizado em segundo plano, nunca ao contrário.

Desenvolvimento faseado:
- **V0** — contagem manual, sem IA, já em produção, gerando dataset real.
- **V1** — YOLOv8 assistindo a contagem, treinado com as imagens da V0.

---

## 2. Stack Tecnológico Final

| Camada | Tecnologia | Função |
|---|---|---|
| **Sistema Operacional (servidor)** | Ubuntu Server | Base da máquina local no galpão |
| **Orquestração** | Docker + Docker Compose | Isola e sobe todos os serviços juntos |
| **Backend / API** | Node.js (Express) | Regras de negócio, autenticação, orquestração |
| **Banco de Dados** | PostgreSQL | Fonte da verdade: produtos, ledger, conferências, usuários |
| **Armazenamento de imagens** | Volume local do Docker (disco do servidor) | Fotos originais e dataset validado |
| **Motor de IA (inferência)** | Python + OpenCV + YOLOv8 | V1 — sugestão de contagem de camadas |
| **Worker de Treinamento** | Python + Docker (container isolado) | V1 — retreino periódico do modelo |
| **Túnel de acesso remoto** | Cloudflare Tunnel (`cloudflared`) + **Cloudflare Access** | Expõe a API via HTTPS sem IP público, com autenticação obrigatória na borda |
| **App Mobile** | React Native (Expo) | Interface do operador |
| **Armazenamento local no celular** | SQLite | Fila offline de fotos/contagens |
| **Sincronização de leitura** | Node.js + biblioteca `google-spreadsheet` (Service Account) | Espelha o ledger no Google Sheets, de forma assíncrona |

---

## 3. Infraestrutura

### 3.1 Servidor local

Uma máquina (mini PC, notebook dedicado ou desktop) no próprio galpão, rodando Ubuntu Server, com todos os serviços em containers via `docker-compose`:

- `api` (Node.js)
- `db` (PostgreSQL)
- `ia-worker` (Python — inferência e treino, V1)
- `cloudflared` (túnel de acesso remoto)

**Risco assumido:** se o servidor desligar ou a internet do galpão cair, o sistema fica indisponível — não há redundância em nuvem. Aceitável neste contexto, pois sem energia/rede também não há operação.

### 3.2 Acesso remoto

- O container `cloudflared` cria um túnel de saída do servidor para a Cloudflare, gerando uma URL HTTPS estável, sem precisar de IP público nem abrir porta no roteador.
- **Cloudflare Access é obrigatório** na frente do túnel: qualquer requisição precisa passar por autenticação (ex.: código por e-mail) antes de alcançar a API. Isso evita depender apenas do sigilo da URL.
- Alternativa mais simples de configurar, caso se opte por não usar Cloudflare Access: **Tailscale**, criando uma rede privada entre o servidor e os celulares autorizados — nenhuma URL pública existe nesse modelo.

### 3.3 Armazenamento de imagens

- Fotos salvas em volume local do Docker, organizadas por status:
  ```
  /dataset
    /inbound          → fotos novas, aguardando confirmação
    /images/train      → dataset validado para treino (V1)
    /images/val         → dataset de validação (V1)
  ```
- O PostgreSQL guarda apenas o **caminho** do arquivo (`url_imagem_local`), nunca o binário da imagem.

---

## 4. Estrutura de Arquivos do Projeto

```
tebarrot-estoque/
│
├── docker-compose.yml
├── .env                          # variáveis sensíveis (não versionado)
├── .env.example
│
├── api/                          # Backend Node.js
│   ├── src/
│   │   ├── config/               # conexão com banco, cloudflare, sheets
│   │   ├── controllers/          # lógica de cada rota (produtos, conferencias, auth)
│   │   ├── routes/               # definição dos endpoints
│   │   ├── services/
│   │   │   ├── ledgerService.js       # regras do ledger de movimentações
│   │   │   ├── conferenciaService.js  # criação/consulta de conferências
│   │   │   ├── sheetsSyncService.js   # sincronização assíncrona com Google Sheets
│   │   │   └── iaClient.js            # comunicação com o worker de IA (V1)
│   │   ├── models/                # definição das tabelas (ORM ou query builder)
│   │   ├── middlewares/           # autenticação (PIN/crachá), validação
│   │   └── app.js
│   ├── migrations/                # scripts de criação/alteração do schema
│   ├── package.json
│   └── Dockerfile
│
├── ia-worker/                     # Serviço Python (V1)
│   ├── inference/
│   │   └── predict.py             # roda YOLOv8 sobre uma imagem, retorna nº de camadas
│   ├── training/
│   │   ├── train.py                # fine-tuning periódico
│   │   ├── build_dataset.py        # monta pastas train/val a partir do banco
│   │   └── validate_model.py       # valida novo best.pt contra conjunto de teste fixo
│   ├── models/
│   │   └── best.pt                 # peso atual em produção
│   ├── requirements.txt
│   └── Dockerfile
│
├── mobile-app/                    # React Native (Expo)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.js          # crachá (QR) com fallback de PIN
│   │   │   ├── HomeScreen.js
│   │   │   ├── CapturaScreen.js        # câmera + overlay-guia
│   │   │   ├── ConferenciaScreen.js    # revisão da contagem, +1/-1
│   │   │   └── SyncStatusScreen.js     # status da fila offline
│   │   ├── services/
│   │   │   ├── api.js                  # cliente HTTP (URL do Cloudflare Tunnel)
│   │   │   ├── localDb.js              # SQLite — fila offline
│   │   │   └── syncQueue.js            # lógica de sincronização em background
│   │   ├── components/
│   │   └── App.js
│   ├── app.json
│   └── package.json
│
└── docs/
    ├── Documentacao_de_Arquitetura_e_Engenharia_v3.md   # este documento
    └── schema.sql                                        # DDL completo do banco
```

---

## 5. Comportamento do Sistema

### 5.1 Login (rápido, sem e-mail/senha)

1. App abre direto na tela de login.
2. **Caminho principal:** operador bipa o QR code do crachá → app valida o ID na API → sessão liberada.
3. **Fallback sempre visível:** botão "Entrar com PIN" — operador seleciona o nome numa lista e digita PIN de 4-6 dígitos. Existe para cobrir crachá perdido, danificado, ou câmera com problema.
4. Sessão permanece ativa no aparelho (dispositivos são fixos/compartilhados no galpão) — não pede login a cada uso.

### 5.2 Fluxo de conferência

1. **Bipar SKU** da etiqueta da pilha.
2. API consulta o PostgreSQL e retorna a regra de empilhamento do produto (`volumes_por_camada`).
3. **Captura da foto:** tela de câmera com overlay-guia fixo, indicando ângulo/distância. Regra: 1 foto = 1 pilha.
4. **Contagem:**
   - V0: operador informa manualmente o número de camadas.
   - V1: YOLOv8 sugere o número de camadas; operador confirma ou ajusta.
5. **Revisão:** tela mostra o total calculado (`camadas × volumes_por_camada`), com botões grandes +1/-1 para ajuste manual (avarias, palete incompleto).
6. **Confirmação:**
   - Se **online**: dados enviados direto à API → grava movimentação no ledger → grava conferência → dispara sync assíncrona com o Sheets.
   - Se **offline**: foto e dados gravados no SQLite local do celular, marcados como "pendente de sincronização".

### 5.3 Sincronização offline → online

- O app verifica conectividade em background.
- Ao detectar acesso à API (via túnel), esvazia a fila do SQLite automaticamente, na ordem em que foi criada.
- Cada item sincronizado com sucesso é removido da fila local; falhas mantêm o item na fila para nova tentativa.
- Tela de status de sincronização permite ao operador ver quantos itens estão pendentes.

### 5.4 Escrita no banco (ledger, nunca saldo mutável)

- Toda confirmação de contagem gera um registro **novo e imutável** na tabela `movimentacoes_estoque` (entrada/saída/ajuste).
- O saldo de qualquer produto é sempre `SUM(quantidade)` das movimentações — nunca um campo sobrescrito.
- Cada movimentação carrega `id_operador` e `id_conferencia`, garantindo auditoria completa (quem, quando, a partir de qual foto).

### 5.5 Sincronização com Google Sheets (V0 e V1)

- Roda **de forma assíncrona**, depois que a API já respondeu "confirmado" ao app — nunca bloqueia a operação do galpão.
- Fluxo: Postgres grava a movimentação → job em background chama a API do Google Sheets (via Service Account) → atualiza a linha do SKU correspondente.
- Falhas na escrita do Sheets são reenfileiradas com retry; o operador nunca percebe, e o dado real permanece correto no Postgres mesmo se o Sheets estiver temporariamente indisponível.

### 5.6 Treinamento e atualização do modelo de IA (V1)

1. Worker consulta conferências com `status_dataset = pendente_treinamento`.
2. Copia as imagens correspondentes do volume local para a área de treino.
3. Gera os arquivos de label a partir das contagens confirmadas no banco.
4. Roda o fine-tuning do YOLOv8.
5. **Antes de promover o novo peso:** `validate_model.py` testa o novo `best.pt` contra um conjunto de teste fixo. Se a precisão piorar em relação ao modelo em produção, o deploy é **bloqueado** e o modelo anterior é mantido.
6. Se aprovado, o novo `best.pt` substitui o modelo em produção e as conferências usadas no treino são marcadas como `treinado`.

---

## 6. Estrutura de Dados (resumo — DDL completo em `docs/schema.sql`)

- **`produtos`** — SKU, descrição, `volumes_por_camada`, `camadas_maximas_palete`.
- **`movimentacoes_estoque`** — ledger imutável de entradas/saídas/ajustes.
- **`conferencias`** — cada contagem realizada: imagem, camadas informadas, origem (manual/IA), status do dataset.
- **`usuarios`** — operadores, com login por crachá ou PIN.

---

## 7. Roadmap de Implementação

1. Subir `docker-compose.yml` com `api`, `db`, `cloudflared` (V0 ainda sem `ia-worker`).
2. Rodar migrations do PostgreSQL (`produtos`, `movimentacoes_estoque`, `conferencias`, `usuarios`).
3. Popular `produtos` com os SKUs e regras reais do galpão (Master Data inicial).
4. Implementar API: autenticação (PIN + crachá), endpoint de conferência, endpoint de consulta de saldo.
5. Implementar `mobile-app`: login, captura com overlay-guia, tela de revisão +1/-1, fila offline em SQLite.
6. Configurar Cloudflare Tunnel + Access (ou Tailscale) para acesso remoto.
7. Implementar `sheetsSyncService` (assíncrono, com retry).
8. Lançar V0 em produção e acumular dataset real.
9. Após volume suficiente de conferências, subir `ia-worker`, treinar o primeiro YOLOv8 e implementar `validate_model.py`.
10. Ativar V1: inferência assistindo a contagem no app.

---

*Documento final consolidado para início de desenvolvimento — infraestrutura local, acesso mobile remoto, ledger de estoque, dataset gerado organicamente na V0, IA assistida na V1.*
