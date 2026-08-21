const { Pool } = require('pg');
const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});
async function run() {
  const client = await pool.connect();
  const query = `
    SELECT m.armazem_id, a.nome as armazem, s.sku, s.descricao, 
           SUM(m.quantidade) as saldo
    FROM movimentacoes_estoque m
    JOIN skus s ON m.sku_id = s.id
    JOIN armazens a ON m.armazem_id = a.id
    GROUP BY m.armazem_id, a.nome, s.sku, s.descricao
    HAVING SUM(m.quantidade) != 0
    ORDER BY s.descricao, a.nome
  `;
  const res = await client.query(query);
  
  const id334 = '18795859-8bcf-4ebb-9b94-24e5a34e2452';
  const id346 = 'eed582f1-3125-4c16-8dce-df464a151239';

  const grouped = {};
  res.rows.forEach(r => {
     if (!grouped[r.sku]) grouped[r.sku] = { descricao: r.descricao, saldos: {} };
     grouped[r.sku].saldos[r.armazem] = Number(r.saldo);
  });
  
  let conflitosEncontrados = 0;
  console.log('--- RELATÓRIO DE COMPARAÇÃO: Barracão 334 vs Barracão 346 ---\n');
  for (const sku in grouped) {
     const prod = grouped[sku];
     const s334 = prod.saldos['Barracão 334'] || 0;
     const s346 = prod.saldos['Barracão 346'] || 0;
     
     if ((s334 < 0 && s346 > 0) || (s334 > 0 && s346 < 0)) {
         console.log(`[CONFLITO] ${sku} - ${prod.descricao}`);
         console.log(`   -> Barracão 334: ${s334}`);
         console.log(`   -> Barracão 346: ${s346}\n`);
         conflitosEncontrados++;
     }
  }

  if (conflitosEncontrados === 0) {
     console.log('Nenhum produto com saldo negativo em um e positivo em outro (nos barracões analisados).');
  }
  
  console.log('--- OUTROS PRODUTOS COM SALDO NEGATIVO ---');
  let negCount = 0;
  for (const sku in grouped) {
     const prod = grouped[sku];
     const s334 = prod.saldos['Barracão 334'] || 0;
     const s346 = prod.saldos['Barracão 346'] || 0;
     
     if ((s334 < 0 || s346 < 0) && !((s334 < 0 && s346 > 0) || (s334 > 0 && s346 < 0))) {
         console.log(`[NEGATIVO] ${sku} - ${prod.descricao}`);
         console.log(`   -> Barracão 334: ${s334}`);
         console.log(`   -> Barracão 346: ${s346}\n`);
         negCount++;
     }
  }
  
  if (negCount === 0) console.log('Nenhum outro produto negativo.');

  client.release();
  await pool.end();
}
run();
