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
  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name IN ('produtos', 'skus', 'estoques', 'movimentacoes_estoque', 'armazens') 
    ORDER BY table_name, ordinal_position;
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  
  const res2 = await client.query(`
    SELECT id, sku, descricao FROM skus WHERE descricao ILIKE '%cadeira%' OR descricao ILIKE '%mona%' OR descricao ILIKE '%air%' OR descricao ILIKE '%uxuá%' OR descricao ILIKE '%uxua%';
  `);
  console.log("SKUs with null equivalents:");
  console.log(JSON.stringify(res2.rows, null, 2));

  await client.end();
}

run().catch(console.error);
