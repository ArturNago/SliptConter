const { Client } = require('pg');

const items = [
  { code: '16005', desc: 'BUFFET DUNA RIPADO - NATURE', qtd: 15 },
  { code: '1287', desc: 'BUFFET DETROIT 4 PORTAS - OFF WHITE/NATURE', qtd: 10 },
  { code: '1279', desc: 'BUFFET DETROIT 4 PORTAS - BRANCO/NATURE', qtd: 2 },
  { code: '1284', desc: 'BUFFET DETROIT 4 PORTAS - NATURE', qtd: 15 },
  { code: '1174', desc: 'BUFFET ARES LUX 3 PORTAS - OFF WHITE', qtd: 10 },
  { code: '1195', desc: 'BUFFET ARES LUX 4 PORTAS - OFF WHITE', qtd: 10 },
  { code: '1185', desc: 'BUFFET ARES LUX 4 PORTAS - BRANCO/NATURE', qtd: 5 },
  { code: '1191', desc: 'BUFFET ARES LUX 4 PORTAS - NATURE', qtd: 15 },
  { code: '10262', desc: 'BIBOX MATRIX - BRANCO', qtd: 15 },
  { code: '1322', desc: 'LUMINÁRIA CLASSIC', qtd: 10 },
  { code: '1310', desc: 'CABECEIRA HAVANA CASAL - BRANCO', qtd: 10 },
  { code: '1316', desc: 'CABECEIRA HAVANA CASAL - NATURE', qtd: 10 },
  { code: '17191', desc: 'CABECEIRA HAVANA CASAL - OFF WHITE/NATURE', qtd: 10 },
  { code: '10713', desc: 'MESA CENTRO ELEGANCE - NATURE', qtd: 20 },
  { code: '10494', desc: 'KIT 2 UND CADEIRA DETROIT - 227', qtd: 10 },
  { code: '13799', desc: 'KIT 2 UND CADEIRA DETROIT - 530', qtd: 10 },
  { code: '16202', desc: 'POLTRONA AIR NEW - 226', qtd: 3 },
  { code: '16204', desc: 'POLTRONA AIR NEW - 336', qtd: 3 },
  { code: '2168', desc: 'POLTRONA AIR - 226', qtd: 3 },
  { code: '16638', desc: 'POLTRONA UXUA NEW - 104', qtd: 3 },
  { code: '12668', desc: 'POLTRONA UXUA DESMONTADA - 104', qtd: 3 },
  { code: '16193', desc: 'POLTRONA UXUA NEW - 226', qtd: 7 },
  { code: '12662', desc: 'POLTRONA UXUA DESMONTADA - 226', qtd: 3 },
  { code: '2599', desc: 'PUFF SOHO I - 104', qtd: 5 },
  { code: '2607', desc: 'PUFF SOHO I - 226', qtd: 5 },
  { code: '2651', desc: 'PUFF SOHO II - 226', qtd: 2 },
  { code: '2675', desc: 'PUFF SOHO II - 305', qtd: 1 },
  { code: '2686', desc: 'PUFF SOHO III - 104', qtd: 3 },
  { code: '2694', desc: 'PUFF SOHO III - 226', qtd: 2 }
];

const id_operador = 'b9db434d-2e0f-4469-adf0-c9b03299d238';
const armazem_id = '18795859-8bcf-4ebb-9b94-24e5a34e2452';
const observacao = 'Reposição de produtos - entrada manual';

async function run() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'tebarrot',
    password: '141205',
    database: 'tebarrot_estoque',
  });
  await client.connect();

  let foundCount = 0;
  for (let item of items) {
    let sku_id = null;
    let desc_found = '';
    let usedMethod = '';
    
    let res = await client.query('SELECT sku_id FROM mapeamento_anuncios_sku WHERE sku_erp = $1', [item.code]);
    if (res.rows.length > 0) {
      sku_id = res.rows[0].sku_id;
      usedMethod = 'sku_erp';
    } else {
      res = await client.query('SELECT id FROM skus WHERE sku = $1', [item.code]);
      if (res.rows.length > 0) {
        sku_id = res.rows[0].id;
        usedMethod = 'exact_sku';
      } else {
        let words = item.desc.split(/[ -/]+/).filter(w => w.length > 2);
        let searchPattern = '%' + words.join('%') + '%';
        let query = `
          SELECT s.id, s.sku, s.descricao 
          FROM skus s 
          WHERE s.descricao ILIKE $1 OR s.sku ILIKE $1
        `;
        res = await client.query(query, [searchPattern]);
        if (res.rows.length === 0) {
           query = `
             SELECT s.id, s.sku, s.descricao, p.nome as produto_nome
             FROM skus s
             JOIN produtos p ON s.produto_id = p.id
             WHERE p.nome ILIKE $1 OR s.descricao ILIKE $1
           `;
           res = await client.query(query, [searchPattern]);
        }
        
        if (res.rows.length > 0) {
          sku_id = res.rows[0].id;
          desc_found = res.rows[0].descricao;
          usedMethod = 'fuzzy_desc';
        }
      }
    }
    
    if (sku_id) {
      console.log(`[OK] Inserted [${item.code}] ${item.desc} (method: ${usedMethod}, qtd: ${item.qtd}) -> sku_id: ${sku_id}`);
      
      const insertQuery = `
        INSERT INTO movimentacoes_estoque (sku_id, tipo, quantidade, id_operador, observacao, armazem_id)
        VALUES ($1, 'entrada', $2, $3, $4, $5)
      `;
      await client.query(insertQuery, [sku_id, item.qtd, id_operador, observacao, armazem_id]);
      foundCount++;
    } else {
      console.log(`[NOT FOUND] Failed to map [${item.code}] ${item.desc}`);
    }
  }
  
  console.log(`Finished processing. Inserted ${foundCount}/${items.length} items.`);
  await client.end();
}

run().catch(console.error);
