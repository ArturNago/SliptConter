const { Pool } = require('pg');
const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});

async function run() {
  const client = await pool.connect();
  const id334 = '18795859-8bcf-4ebb-9b94-24e5a34e2452';
  const id346 = 'eed582f1-3125-4c16-8dce-df464a151239';

  try {
    await client.query('BEGIN');
    console.log('Iniciando correção automática de estoques...\n');

    // Pegar um operador padrão para a movimentação
    const opRes = await client.query('SELECT id FROM usuarios LIMIT 1');
    const idOperador = opRes.rows.length > 0 ? opRes.rows[0].id : null;

    // Função auxiliar para inserir movimentação
    async function inserirMovimentacao(armazemId, skuId, tipo, quantidade, observacao) {
       await client.query(`
         INSERT INTO movimentacoes_estoque (sku_id, armazem_id, tipo, quantidade, id_operador, observacao)
         VALUES ($1, $2, $3, $4, $5, $6)
       `, [skuId, armazemId, tipo, quantidade, idOperador, observacao]);
    }

    // 1. Identificar saldos de todos os SKUs nos armazens
    const res = await client.query(`
      SELECT m.armazem_id, s.id as sku_id, s.sku, s.descricao, 
             SUM(m.quantidade) as saldo
      FROM movimentacoes_estoque m
      JOIN skus s ON m.sku_id = s.id
      GROUP BY m.armazem_id, s.id, s.sku, s.descricao
      HAVING SUM(m.quantidade) != 0
    `);

    const saldos = {}; // sku_id -> { 334: saldo, 346: saldo, sku, desc }
    res.rows.forEach(r => {
       if (!saldos[r.sku_id]) saldos[r.sku_id] = { sku: r.sku, desc: r.descricao, '334': 0, '346': 0, others: {} };
       if (r.armazem_id === id334) saldos[r.sku_id]['334'] = Number(r.saldo);
       else if (r.armazem_id === id346) saldos[r.sku_id]['346'] = Number(r.saldo);
       else saldos[r.sku_id].others[r.armazem_id] = Number(r.saldo);
    });

    let transferencias = 0;
    let ajustes = 0;

    for (const skuId in saldos) {
       const s334 = saldos[skuId]['334'];
       const s346 = saldos[skuId]['346'];
       const prod = saldos[skuId];

       // Conflito: Negativo no 334 e Positivo no 346
       if (s334 < 0 && s346 > 0) {
           const qtdTransf = Math.min(Math.abs(s334), s346);
           console.log(`[Transferência] ${prod.sku}: Transferindo ${qtdTransf} do 346 para o 334.`);
           await inserirMovimentacao(id334, skuId, 'entrada', qtdTransf, 'Transferência Automática - Resolução de Conflito');
           await inserirMovimentacao(id346, skuId, 'saida', -qtdTransf, 'Transferência Automática - Resolução de Conflito');
           transferencias++;
           saldos[skuId]['334'] += qtdTransf;
           saldos[skuId]['346'] -= qtdTransf;
       }
       // Conflito: Negativo no 346 e Positivo no 334
       else if (s346 < 0 && s334 > 0) {
           const qtdTransf = Math.min(Math.abs(s346), s334);
           console.log(`[Transferência] ${prod.sku}: Transferindo ${qtdTransf} do 334 para o 346.`);
           await inserirMovimentacao(id346, skuId, 'entrada', qtdTransf, 'Transferência Automática - Resolução de Conflito');
           await inserirMovimentacao(id334, skuId, 'saida', -qtdTransf, 'Transferência Automática - Resolução de Conflito');
           transferencias++;
           saldos[skuId]['334'] -= qtdTransf;
           saldos[skuId]['346'] += qtdTransf;
       }

       // Após transferências, verificar se ainda há saldo puramente negativo no 334 ou 346
       if (saldos[skuId]['334'] < 0) {
           const qtdZerar = Math.abs(saldos[skuId]['334']);
           console.log(`[Ajuste] ${prod.sku}: Zerando saldo negativo de -${qtdZerar} no Barracão 334.`);
           await inserirMovimentacao(id334, skuId, 'entrada', qtdZerar, 'Ajuste Automático - Zerando Saldo Negativo');
           ajustes++;
       }
       if (saldos[skuId]['346'] < 0) {
           const qtdZerar = Math.abs(saldos[skuId]['346']);
           console.log(`[Ajuste] ${prod.sku}: Zerando saldo negativo de -${qtdZerar} no Barracão 346.`);
           await inserirMovimentacao(id346, skuId, 'entrada', qtdZerar, 'Ajuste Automático - Zerando Saldo Negativo');
           ajustes++;
       }
    }

    console.log(`\nResumo:`);
    console.log(`- Produtos com conflito transferidos: ${transferencias}`);
    console.log(`- Produtos com saldo isolado negativo zerados: ${ajustes}`);

    await client.query('COMMIT');
    console.log('\nTransação concluída. O banco de dados está íntegro.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na operação. Rollback realizado:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
