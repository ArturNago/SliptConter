
const { Client } = require('c:/Codigos/SliptConter/api/node_modules/pg');
async function test() {
  const client = new Client({
    host: 'localhost', port: 5433, user: 'tebarrot', password: '141205', database: 'tebarrot_estoque'
  });
  await client.connect();
  const res = await client.query(\
    SELECT 
      s.sku,
      s.descricao,
      COALESCE(SUM(CASE WHEN m.armazem_id = '18795859-8bcf-4ebb-9b94-24e5a34e2452' THEN m.quantidade ELSE 0 END), 0)::int as saldo_334,
      COALESCE(SUM(CASE WHEN m.armazem_id = 'a3c89243-2847-4fb2-8f7c-dd687ca3116e' THEN m.quantidade ELSE 0 END), 0)::int as saldo_418,
      COALESCE(SUM(m.quantidade), 0)::int as total,
      COALESCE(SUM(CASE WHEN m.quantidade < 0 THEN ABS(m.quantidade) ELSE 0 END), 0)::int as vendas_historico
    FROM skus s
    LEFT JOIN movimentacoes_estoque m ON m.sku_id = s.id
    GROUP BY s.sku, s.descricao
    HAVING COALESCE(SUM(m.quantidade), 0) > 0 OR COALESCE(SUM(CASE WHEN m.quantidade < 0 THEN ABS(m.quantidade) ELSE 0 END), 0) > 0
    ORDER BY total ASC, vendas_historico DESC
    LIMIT 20;
  \);
  console.table(res.rows);
  await client.end();
}
test();

