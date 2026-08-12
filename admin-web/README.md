# SliptConter Web Admin

Painel Web de Administração de Estoque (React 18 + Vite) para **Administradores e Gestores**, consumindo a API Node.js existente (`/api`).

## Módulos

- **Login & RBAC** — autenticação JWT; telas restritas a `admin`/`gestor`.
- **Dashboard Executivo** — KPIs (volumes, valor total, SKUs, conferências do dia, pendências Sheets), gráficos de entradas/saídas/ajustes e distribuição por armazém/categoria.
- **Matriz de Estoque** — tabela filtrável de SKUs com saldo derivado do ledger, status de estoque e ajuste manual.
- **Auditoria de Conferências** — galeria de fotos do galpão com comparativo IA × operador.
- **Ledger de Movimentações** — extrato imutável de entradas/saídas/ajustes.
- **Cadastro de SKUs** — master data (volumes por camada, camadas, EAN, custo, preço).
- **Gestão de Operadores** — cadastro, edição e crachá com QR Code para impressão.

## Desenvolvimento

```powershell
cd admin-web
npm install
# crie um .env com VITE_API_URL=http://localhost:3000 (ou o túnel)
npm run dev      # http://localhost:3000
npm run build    # bundle de produção em dist/
```

## Docker

O serviço `admin-web` foi adicionado ao `docker-compose.yml` (porta **8081** no host → 80 no container, Nginx servindo o SPA). Sobe com:

```powershell
docker compose up -d --build admin-web
```

A variável `VITE_API_URL` é definida em build-time (via `docker-compose` environment ou `.env`).

## Endpoints consumidos (backend)

- `GET /api/admin/dashboard-metrics`
- `GET /api/admin/estoque-consolidado`
- `POST /api/admin/estoque/ajuste`
- `GET /api/admin/relatorios/exportar`
- `GET|POST|PATCH /api/admin/usuarios`
- `GET /api/armazens`, `GET /api/conferencias`, `GET /api/movimentacoes`, `GET|POST|PATCH /api/produtos`
