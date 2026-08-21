const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});

function generateSkuFromDesc(desc) {
  // Remover acentos
  let text = desc.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Substituir barras, hífens e pontuações por espaço
  text = text.replace(/[\/\-\.,;\(\)]/g, " ");
  
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  
  const ignored = ['de', 'da', 'do', 'com', 'em', 'para', 'e', 'no', 'na', 'os', 'as'];
  
  let parts = [];
  for (let w of words) {
    if (ignored.includes(w.toLowerCase()) && parts.length > 0) continue; // Pode ignorar, a menos que seja a primeira palavra (improvável)
    
    // Se a palavra for um número ou tiver números, mantemos inteira ou até 4 chars
    // Mas a planilha ouro mantém números curtos inteiros.
    let part = w.toUpperCase();
    if (part.length > 4 && !/\d/.test(part)) {
       part = part.substring(0, 4);
    } else if (part.length > 4) {
       // se tiver número longo, corta no 4 tbm
       part = part.substring(0, 4);
    }
    parts.push(part);
  }
  
  return parts.join('-');
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Iniciando padronização de nomenclatura dos SKUs restantes...\n');

    const res = await client.query(`
      SELECT id, sku, descricao 
      FROM skus 
      WHERE sku LIKE 'PROD-%' 
         OR sku != UPPER(sku) 
         OR sku LIKE '% %'
    `);

    console.log(`${res.rows.length} SKUs encontrados para conversão.`);

    const existingRes = await client.query('SELECT sku FROM skus');
    const existingSkus = new Set(existingRes.rows.map(r => r.sku));

    let updatedCount = 0;

    for (let row of res.rows) {
      let baseNewSku = generateSkuFromDesc(row.descricao);
      let newSku = baseNewSku;
      let suffix = 2;

      // Garantir unicidade
      while (existingSkus.has(newSku) && newSku !== row.sku) {
        newSku = `${baseNewSku}-${suffix}`;
        suffix++;
      }

      console.log(`[${row.sku}] -> [${newSku}] (${row.descricao})`);

      if (newSku !== row.sku) {
         await client.query('UPDATE skus SET sku = $1 WHERE id = $2', [newSku, row.id]);
         existingSkus.delete(row.sku);
         existingSkus.add(newSku);
         updatedCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\nSucesso! ${updatedCount} SKUs foram padronizados de forma definitiva no banco de dados.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na operação. Rollback realizado:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
