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
  const updates = JSON.parse(fs.readFileSync('final_updates.json', 'utf8'));

  const id_operador = 'b9db434d-2e0f-4469-adf0-c9b03299d238';
  
  // Try to find the correct armazém id
  const armRes = await client.query("SELECT id FROM armazens WHERE nome ILIKE '%334%' OR codigo = '334' LIMIT 1");
  let armazem_id = '18795859-8bcf-4ebb-9b94-24e5a34e2452'; // default fallback
  if (armRes.rows.length > 0) {
      armazem_id = armRes.rows[0].id;
  }

  const observacao = 'Contagem Manual de Estoque (Estoque.xlsx)';

  let successCount = 0;
  for (let row of updates) {
    if (!row.sku_id) {
       console.log(`[SKIP] No SKU ID for: ${row.original}`);
       continue;
    }
    
    try {
      await client.query(`
        INSERT INTO movimentacoes_estoque (sku_id, tipo, quantidade, id_operador, observacao, armazem_id)
        VALUES ($1, 'entrada', $2, $3, $4, $5)
      `, [row.sku_id, row.qty, id_operador, observacao, armazem_id]);
      console.log(`[OK] Inserted ${row.qty} for ${row.chosen}`);
      successCount++;
    } catch (e) {
      console.log(`[ERROR] Failed to insert for ${row.chosen}: ${e.message}`);
    }
  }

  console.log(`Finished processing. Successfully inserted ${successCount} entries.`);
  await client.end();
}

run().catch(console.error);
