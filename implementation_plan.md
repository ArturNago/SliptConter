# Plano de Implementação — Painel Web de Administração de Estoque (SliptConter Web Admin)

Este plano descreve a arquitetura, estrutura de módulos, design de interface e fluxo de integração para desenvolver a versão Web do **SliptConter**, voltada exclusivamente para **Administradores e Gestores** acessarem via computador.

---

## 1. Visão Geral e Objetivos

Atualmente, o **SliptConter** conta com uma API em Node.js (Express + PostgreSQL) e um aplicativo móvel em React Native (Expo) focado na operação de galpão (bipar SKU, tirar foto do palete, contar camadas e registrar movimentações).

O **Painel Web do Administrador** atenderá às seguintes necessidades estratégicas:
- **Visão 360° do Estoque:** Consulta em tempo real de **todo o estoque da loja/galpão** (`SUM(quantidade)` do ledger imutável) por SKU e por Armazém.
- **Auditoria de Conferências Móveis:** Visualização das fotos tiradas pelos operadores no galpão, comparação entre a contagem sugerida pela IA (YOLOv8) e o ajuste manual feito pelo operador.
- **Gestão de Cadastro Mestre (Master Data):** Criação e edição de SKUs, regras de empilhamento (`volumes_por_camada`, `camadas_maximas_palete`), custos e preços de venda.
- **Auditoria Ledger Imutável:** Histórico completo de entradas, saídas e ajustes com filtros por data, operador, produto e tipo de movimentação.
- **Gestão de Operadores e Crachás:** Cadastro de operadores, definição de PINs e geração de QR Codes para impressão de crachás.
- **Monitoramento de Integrações:** Status da fila de sincronização assíncrona com o Google Sheets e saúde dos serviços.

---

## 2. Escolha Tecnológica & Arquitetura

| Camada | Tecnologia Escolhida | Racional |
|---|---|---|
| **Framework Web** | **React 18 + Vite** (Single Page Application) | Build extremamente rápido, leveza, inicialização instantânea no desktop. |
| **Estilização / UI** | **Vanilla CSS + Design Tokens** (Tema Escuro / Light Premium) | Flexibilidade total de layout, sem dependências pesadas, micro-animações, cards com glassmorphism e tabelas responsivas de alto desempenho. |
| **Gerenciamento de Estado / API** | **Axios + React Query / Context API** | Cache eficiente de dados de estoque, re-fetch automático e tratamento centralizado de erros de rede/autenticação. |
| **Ícones e Gráficos** | **Lucide React + Chart.js / Recharts** | Visualização clara de métricas de estoque, curvas de entradas/saídas e distribuição por categoria. |
| **Segurança e Auth** | **JWT (Bearer Token)** | Integração direta com os endpoints `/api/auth/login` e validação do papel do usuário (`admin` ou `gestor`). |
| **Hospedagem / Deploy** | **Docker Container (`nginx` / `vite preview`)** | Adicionado ao `docker-compose.yml` local e exposto de forma segura via Cloudflare Tunnel ou subporta local. |

---

## 3. Módulos e Funcionalidades do Painel Web

### Módulo 1: Autenticação e Controle de Acesso (Login & Session)
- Tela de login web segura por Usuário/Senha ou PIN de Administrador.
- Armazenamento do token JWT em `sessionStorage` / `localStorage` seguro.
- Interceptador HTTP para renovação ou redirecionamento automático em caso de sessão expirada.
- Controle por Papel (RBAC): telas administrativas restritas a `admin` e `gestor`.

### Módulo 2: Dashboard Executivo (Visão Geral de Estoque)
- **KPIs em Destaque:**
  - Quantidade Total de Volumes em Estoque (`SUM(quantidade)` global).
  - Valor Total do Estoque Estimado (Custo Médio x Saldo).
  - Total de SKUs Ativos cadastrados.
  - Conferências Realizadas Hoje (no galpão).
  - Alertas de Estoque Baixo ou Sem Saldo.
  - Pendências da Fila do Google Sheets.
- **Gráficos Interativos:**
  - Evolução temporal de Entradas vs. Saídas vs. Ajustes.
  - Distribuição de estoque por Armazém e por Categoria.

### Módulo 3: Matriz Completa de Estoque (Consulta por SKU & Armazém)
- Tabela rica e pesquisável de **todos os produtos e SKUs**.
- Colunas: SKU, Descrição, Categoria, Armazém, Saldo Atual, Regra de Empilhamento, Valor Unitário, Status do Estoque.
- Filtros avançados: Pesquisa textual (SKU/Descrição/EAN), Filtro por Armazém, Filtro por Categoria, Apenas Estoque Baixo.
- Ordenação por qualquer coluna.
- Exportação dos dados em formato CSV e Excel (XLSX).
- Modal de Detalhes do Produto ao clicar em um item (exibe histórico de conferências e movimentações vinculadas).

### Módulo 4: Auditoria de Conferências & Fotos do Galpão
- Galeria e tabela detalhada de conferências de campo.
- Visualização da foto original capturada no celular pelo operador (`url_imagem_local`).
- Comparativo claro:
  - Quantidade informada pelo operador.
  - Sugestão da IA YOLOv8 (quando em V1).
  - Ajustes manuais (+1/-1) realizados na revisão.
  - Operador responsável e data/hora exata.
- Status do Dataset para treino da IA (`pendente_treinamento`, `treinado`, `na`).

### Módulo 5: Audit Trail / Ledger de Movimentações
- Extrato imutável de movimentações da tabela `movimentacoes_estoque`.
- Exibição de lançamentos de Entrada, Saída e Ajuste.
- Modal para o Administrador registrar **Ajuste Manual de Estoque** justificando o motivo (quebra, inventário geral, perda, devolução).

### Módulo 6: Gestão de Cadastro de SKUs (Master Data)
- Interface de cadastro e edição de SKUs.
- Configuração de `volumes_por_camada`, `camadas_maximas_palete`, `codigo_barras_ean`, `custo_medio` e `preco_venda`.
- Importação em lote por planilha CSV/Excel.
- Ativação/Desativação de SKUs.

### Módulo 7: Gestão de Operadores e Crachás
- Lista de usuários do sistema (`usuarios`).
- Cadastro de novos operadores e gestores.
- Redefinição de PIN de acesso.
- Visualização e impressão do QR Code do crachá do operador direto pelo navegador.

---

## 4. Estrutura de Arquivos Proposta (`admin-web/`)

```
tebarrot-estoque/
├── admin-web/                        # [NOVO] Aplicação Web em React + Vite
│   ├── public/
│   │   ├── favicon.ico
│   │   └── logo.svg
│   ├── src/
│   │   ├── assets/                   # Estilos globais, temas, imagens
│   │   ├── components/               # Componentes reutilizáveis
│   │   │   ├── common/               # Button, Input, Modal, Table, Badge, Card, Spinner
│   │   │   ├── layout/               # Sidebar, Header, PageContainer, Navigation
│   │   │   ├── dashboard/            # KpiCard, StockChart, RecentActivity
│   │   │   ├── stock/                # StockTable, StockFilter, StockAdjustModal
│   │   │   ├── conferencias/         # PhotoViewerModal, ConferenceCard
│   │   │   └── users/                # UserFormModal, BadgeQrModal
│   │   ├── contexts/                 # AuthContext, ThemeContext, NotificationContext
│   │   ├── hooks/                    # useStock, useConferencias, useProducts, useUsers
│   │   ├── services/                 # api.js (Axios base), authService, stockService
│   │   ├── pages/                    # Telas principais
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── StockMatrixPage.jsx
│   │   │   ├── LedgerHistoryPage.jsx
│   │   │   ├── ConferencesPage.jsx
│   │   │   ├── ProductsPage.jsx
│   │   │   ├── UsersPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── utils/                    # Formatadores (moeda, data, quantidade), exportCSV
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile                    # Multi-stage build (Node build + Nginx serve)
│
├── api/                              # Backend Node.js existente
│   └── src/
│       ├── controllers/
│       │   └── adminController.js    # [NOVO] Métricas consolidadas e relatórios para o painel web
│       └── routes/
│           └── adminRoutes.js        # [NOVO] Rotas administrativas (/api/admin/...)
│
└── docker-compose.yml                # [ALTERADO] Inclusão do serviço 'admin-web'
```

---

## 5. Alterações Necessárias no Backend (`api/`)

Para garantir alta performance no Painel Web sem sobrecarregar o banco com múltiplas queries no frontend, serão adicionados endpoints específicos de administração:

1. **`GET /api/admin/dashboard-metrics`**
   - Retorna o total de SKUs, total de peças em estoque, valor total do estoque, conferências do dia e alertas em uma única chamada.

2. **`GET /api/admin/estoque-consolidado`**
   - Retorna a matriz completa de estoque enriquecida (SKU + Descrição + Categoria + Saldo por Armazém + Custo Médio + Status).

3. **`GET /api/admin/relatorios/exportar`**
   - Gera payload estruturado para exportação de relatórios de estoque e movimentações em CSV/Excel.

---

## 6. Alterações em Arquivos Existentes

### 1. `docker-compose.yml`
#### [MODIFY] [docker-compose.yml](file:///c:/Codigos/SliptConter/docker-compose.yml)
- Adicionar o serviço `admin-web`:
  ```yaml
  admin-web:
    build:
      context: ./admin-web
      dockerfile: Dockerfile
    container_name: tebarrot-admin-web
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=https://estoque.puratienda.store
    depends_on:
      - api
    restart: always
  ```

### 2. `api/src/routes/index.js`
#### [MODIFY] [index.js](file:///c:/Codigos/SliptConter/api/src/routes/index.js)
- Registrar as novas rotas administrativas em `/api/admin`.

---

## 7. Decisões de Design e Interface

- **Paleta de Cores:** Estilo Dark/Light com tons Slate/Navy (`#0f172a`), acentos em Azul Indigo (`#6366f1` / `#4f46e5`) e Verde Esmeralda (`#10b981`) para estoques normais / entradas, e Vermelho (`#ef4444`) para alertas de estoque crítico.
- **Tipografia:** Fonte modernista Inter / Roboto para máxima legibilidade de números de SKU e quantidades.
- **Responsividade Desktop:** Otimizado para monitores Full HD (1920x1080) e HD (1360x768), com Sidebar retrátil.

---

## 8. Plano de Verificação e Testes

### Testes Automatizados e Compilação
1. **Compilação do Frontend Web:**
   ```powershell
   cd C:\Codigos\SliptConter\admin-web
   npm run build
   ```
   *Verificar se o TypeScript/Vite gera o bundle de produção sem erros de sintaxe ou imports.*

2. **Teste dos Endpoints no Backend:**
   - Executar `npm test` na pasta `api/` (ou testar rotas via HTTP/curl).

### Verificação Manual
1. **Login & RBAC:**
   - Efetuar login com usuário `Administrador` criado via script de bootstrap.
   - Garantir que o token JWT é mantido e a navegação funciona suavemente.
2. **Consulta Geral de Estoque:**
   - Acessar a tela *Matriz de Estoque* e verificar se a soma dos produtos condiz com a tabela `movimentacoes_estoque`.
   - Testar os filtros de busca por SKU e Armazém.
3. **Auditoria de Conferência com Fotos:**
   - Abrir uma conferência realizada pelo app móvel e verificar se a imagem salva no volume do Docker abre corretamente no modal do navegador.
4. **Edição e Cadastro de Produto:**
   - Cadastrar um novo SKU pelo Painel Web e conferir se ele fica disponível imediatamente para bipagem no App Mobile.
5. **Exportação de Relatórios:**
   - Testar o download do arquivo CSV do estoque.
