const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'tebarrot',
  password: '141205',
  database: 'tebarrot_estoque'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT DISTINCT tipo FROM movimentacoes_estoque;");
  console.log("Tipos de movimentacao:");
  console.log(res.rows);
  
  const res2 = await client.query("SELECT sku_erp, sku_id FROM mapeamento_anuncios_sku LIMIT 5;");
  console.log("Mapeamento (5 rows):");
  console.log(res2.rows);

  await client.end();
}

run().catch(console.error);
