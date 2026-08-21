const { Pool } = require('pg');
const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});

async function run() {
  const client = await pool.connect();
  // Pegar todos os SKUs que tem padrão "PROD-" ou que têm letras minúsculas (o padrão ouro parece ser todo UPPERCASE)
  let res = await client.query(`
    SELECT sku, descricao 
    FROM skus 
    WHERE sku LIKE 'PROD-%' 
       OR sku != UPPER(sku) 
       OR sku LIKE '% %'
  `);
  console.log(`Encontrados ${res.rows.length} SKUs irregulares. Amostra:`);
  res.rows.slice(0, 20).forEach(r => console.log(`- [${r.sku}] ${r.descricao}`));
  
  client.release();
  await pool.end();
}
run();
