const { Client } = require('pg');
const fs = require('fs');
const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'tebarrot',
  password: '141205',
  database: 'tebarrot_estoque'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, sku, descricao FROM skus ORDER BY descricao;');
  fs.writeFileSync('all_skus.json', JSON.stringify(res.rows, null, 2));
  console.log("Saved all_skus.json");
  await client.end();
}

run().catch(console.error);
