const fs = require('fs');
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
  
  // Read Excel data parsed to JSON
  const estoqueData = JSON.parse(fs.readFileSync('../estoque.json', 'utf8'));

  // Get current stock for each SKU
  const stockQuery = `
    SELECT sku_id, sum(
      CASE WHEN tipo = 'entrada' THEN quantidade
           WHEN tipo = 'saida' THEN -quantidade
           ELSE quantidade END
    ) as saldo
    FROM movimentacoes_estoque
    GROUP BY sku_id
  `;
  const stockRes = await client.query(stockQuery);
  const stockMap = {}; // sku_id -> saldo
  for (let row of stockRes.rows) {
    stockMap[row.sku_id] = parseInt(row.saldo);
  }

  // Get all SKUs for mapping
  const skusRes = await client.query('SELECT id, sku, descricao FROM skus');
  const allSkus = skusRes.rows;

  let updatesCount = 0;
  
  const id_operador = 'b9db434d-2e0f-4469-adf0-c9b03299d238'; // Admin or similar
  const armazem_id = '18795859-8bcf-4ebb-9b94-24e5a34e2452'; // Default armazém

  for (let row of estoqueData) {
    let rawName = row['Armazém.1'];
    let manualMappedName = row['Armazém.2'];
    let rawCode = row['Armazém.3']; // e.g. PROD-MSHR5UO8
    let qty = row['Armazém.4'];
    
    if (typeof qty !== 'number' || isNaN(qty)) continue;
    
    let sku_id = null;
    let method = '';

    // If there's an exact raw code, maybe it's sku_erp?
    if (rawCode) {
      const q = await client.query('SELECT sku_id FROM mapeamento_anuncios_sku WHERE sku_erp = $1 LIMIT 1', [rawCode]);
      if (q.rows.length > 0) {
        sku_id = q.rows[0].sku_id;
        method = 'sku_erp';
      }
    }
    
    if (!sku_id && rawCode) {
       // Maybe rawCode is exactly the sku in skus table
       const q = await client.query('SELECT id FROM skus WHERE sku = $1 LIMIT 1', [rawCode]);
       if (q.rows.length > 0) {
         sku_id = q.rows[0].id;
         method = 'sku';
       }
    }

    if (!sku_id) {
       // Search by manualMappedName or rawName
       let nameToSearch = manualMappedName || rawName;
       if (nameToSearch) {
         // simple search
         let words = nameToSearch.split(/[ -/]+/).filter(w => w.length > 2);
         let searchPattern = '%' + words.join('%') + '%';
         const q = await client.query('SELECT id, descricao FROM skus WHERE descricao ILIKE $1 OR sku ILIKE $1', [searchPattern]);
         if (q.rows.length === 1) {
           sku_id = q.rows[0].id;
           method = 'fuzzy 1 match (' + q.rows[0].descricao + ')';
         } else if (q.rows.length > 1) {
           method = 'multiple matches: ' + q.rows.map(r=>r.descricao).join(' | ');
         } else {
           method = 'no matches';
         }
       }
    }
    
    console.log(`[${sku_id ? 'OK' : 'FAIL'}] ${rawName} -> ${sku_id} (Method: ${method})`);
  }

  await client.end();
}

run().catch(console.error);
