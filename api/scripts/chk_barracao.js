const { Pool } = require('pg');
const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});
async function run() {
  const client = await pool.connect();
  
  const id334 = '18795859-8bcf-4ebb-9b94-24e5a34e2452';
  const id346 = 'eed582f1-3125-4c16-8dce-df464a151239';

  const query = `
    SELECT 
      s.sku, s.descricao,
      SUM(CASE WHEN m.armazem_id = $1 AND m.tipo = 'entrada' THEN m.quantidade
               WHEN m.armazem_id = $1 AND m.tipo = 'saida' THEN -m.quantidade ELSE 0 END) as saldo_334,
      SUM(CASE WHEN m.armazem_id = $2 AND m.tipo = 'entrada' THEN m.quantidade
               WHEN m.armazem_id = $2 AND m.tipo = 'saida' THEN -m.quantidade ELSE 0 END) as saldo_346
    FROM skus s
    JOIN movimentacoes_estoque m ON s.id = m.sku_id
    WHERE m.armazem_id IN ($1, $2)
    GROUP BY s.id, s.sku, s.descricao
    HAVING 
      SUM(CASE WHEN m.armazem_id = $1 AND m.tipo = 'entrada' THEN m.quantidade WHEN m.armazem_id = $1 AND m.tipo = 'saida' THEN -m.quantidade ELSE 0 END) != 0
      OR
      SUM(CASE WHEN m.armazem_id = $2 AND m.tipo = 'entrada' THEN m.quantidade WHEN m.armazem_id = $2 AND m.tipo = 'saida' THEN -m.quantidade ELSE 0 END) != 0
    ORDER BY s.descricao
  `;
  
  const res = await client.query(query, [id334, id346]);
  
  const discrepancias = res.rows.filter(r => (Number(r.saldo_334) < 0 && Number(r.saldo_346) > 0) || (Number(r.saldo_334) > 0 && Number(r.saldo_346) < 0));
  const outrosNegativos = res.rows.filter(r => (Number(r.saldo_334) < 0 || Number(r.saldo_346) < 0) && !discrepancias.includes(r));
  const normais = res.rows.filter(r => Number(r.saldo_334) >= 0 && Number(r.saldo_346) >= 0);

  console.log('--- RELATÓRIO DE COMPARAÇÃO: Barracão 334 vs Barracão 346 ---\n');
  
  if (discrepancias.length > 0) {
      console.log('🚨 CONFLITOS DETECTADOS (Positivo em um, Negativo no outro):');
      discrepancias.forEach(r => console.log(`   [${r.sku}] ${r.descricao} \n      ➜ Barracão 334: ${r.saldo_334} | Barracão 346: ${r.saldo_346}`));
  } else {
      console.log('✅ Nenhum conflito direto (positivo vs negativo) entre os dois barracões.');
  }

  if (outrosNegativos.length > 0) {
      console.log('\n⚠️ OUTROS SALDOS NEGATIVOS ENCONTRADOS:');
      outrosNegativos.forEach(r => console.log(`   [${r.sku}] ${r.descricao} \n      ➜ Barracão 334: ${r.saldo_334} | Barracão 346: ${r.saldo_346}`));
  }

  console.log('\n📦 SALDOS POSITIVOS (Amostra):');
  normais.slice(0, 10).forEach(r => console.log(`   [${r.sku}] ${r.descricao} \n      ➜ Barracão 334: ${r.saldo_334} | Barracão 346: ${r.saldo_346}`));

  client.release();
  await pool.end();
}
run();
