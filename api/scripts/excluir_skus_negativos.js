const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});

const skusToDelete = [
  'MESA-LATE-TAMP-REDO-CLAS',
  'MESA-LATE-SALA-ESTA-13X',
  'MESA-LATE-REDO-BASE-MADE',
  'NAMO-MONA',
  'NAMO-MONA-128-VERD-SAGE',
  'NAMO-MONA-337-CINZ',
  'NAMO-MONA-BEGE-CLAR',
  'NAMO-MONA-BEGE-CLAR-COR',
  'POLT-TAIP-OUTD-AZUL-MARI',
  'POLT-TAIP-OUTD-VERD',
  'POLT-TAIP-OUTD-VERD-COR',
  'PROD-CERT-REPL',
  'PAIN-LUNA-OFF-WHIT',
  'PAIN-LUNA-OFF-WHIT-FREI',
  'PAIN-LUNA-PRET',
  'PAIN-LUNA-BRAN',
  'PAIN-LUNA-BRAN-FREI-FREI',
  'POLT-AIR-VELU-BASE-MADE',
  'POLT-AIR-LINH-ROSE-REF',
  'POLT-BASE-MADE-AIR-VELU',
  'POLT-BASE-MADE-PETA-VELU',
  'POLT-BROO-LINH-CINZ-MARR',
  'POLT-BROO-LINH-MESC',
  'POLT-BROO-LINH-MESC-COR',
  'POLT-BROO-MLDM-331-CAPU',
  'POLT-BROO-BEGE-ESCU',
  'POLT-BROO-BASE-MADE-MLDM',
  'POLT-BROO-BASE-MADE-ESTO',
  'POLT-CARA-CIME',
  'POLT-CARA-BASE-MADE-CORI',
  'POLT-CARA-BASE-MADE-MACI',
  'POLT-CARA-DECO-MADE-AREI',
  'POLT-CARA-LINH-RUST-ROSE',
  'POLT-CARA-LINH-MARR-MIST',
  'POLT-DECO-BASE-MADE-AIR',
  'POLT-DECO-CARA',
  'POLT-DECO-CARA-COR-AREI',
  'POLT-DECO-CARA-COR-CINZ',
  'POLT-DECO-CARA-COR-TERR',
  'POLT-DECO-BASE-MADE-TIP',
  'POLT-DECO-ENCO-TELA-CARA',
  'POLT-DECO-PETA-TECI-LINH',
  'POLT-DECO-UXUA-LINH-AREI',
  'POLT-DECO-UXUA-LINH-CINZ',
  'POLT-DECO-UXUA-LINH-ROSE',
  'POLT-DECO-UXUA-LINH-TERR',
  'POLT-DECO-UXUA-LINH-VERD',
  'POLT-DECO-UXUA-LINH-LINH',
  'POLT-DECO-UXUA-NOBU-MARR',
  'POLT-JERI-OUTD-AZUL-MARI',
  'POLT-JERI-OUTD-VERD',
  'POLT-JERI-OUTD-VERD-COR',
  'POLT-MONA-BEGE-CLAR',
  'POLT-MONA-BEGE-CLAR-COR',
  'POLT-MONA-CINZ',
  'POLT-MONA-LINH-PES-MADE',
  'POLT-MONA-128-VERD-SAGE',
  'POLT-MONA-TERR',
  'POLT-MONA-VERD-SAGE',
  'POLT-LINH-BASE-MADE-BROO',
  'POLT-POLO-AREI-SEM-COST',
  'POLT-PREM-UXUA-PES-MADE',
  'POLT-PETA-LINH-PES-MADE',
  'POLT-PETA-TECI-LINH-PES',
  'POLT-BASE-MADE-ESTO-LINH',
  'POLT-UXUA-LINH-336-TERR',
  'POLT-UXUA-PES-MADE-VELU',
  'VOLU-SOFA-LUGA-LOFT-274C'
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`Iniciando exclusão de ${skusToDelete.length} SKUs...`);

    // Pegar IDs
    const res = await client.query('SELECT id, sku FROM skus WHERE sku = ANY($1)', [skusToDelete]);
    const ids = res.rows.map(r => r.id);
    
    if (ids.length === 0) {
      console.log('Nenhum dos SKUs listados foi encontrado no banco de dados.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`${ids.length} SKUs encontrados. Deletando referências...`);

    // 1. Deletar mapeamentos (apenas desconectar, para manter histórico? Não, deletar linha do mapeamento)
    let delMap = await client.query('DELETE FROM mapeamento_anuncios_sku WHERE sku_id = ANY($1)', [ids]);
    console.log(`- ${delMap.rowCount} mapeamentos deletados.`);

    // 2. Achar as movimentações para deletar a fila de sync primeiro
    const movRes = await client.query('SELECT id FROM movimentacoes_estoque WHERE sku_id = ANY($1)', [ids]);
    const movIds = movRes.rows.map(r => r.id);
    if (movIds.length > 0) {
       let delSync = await client.query('DELETE FROM sheets_sync_queue WHERE id_movimentacao = ANY($1)', [movIds]);
       console.log(`- ${delSync.rowCount} registros de sync deletados.`);
    }

    // 3. Deletar movimentacoes
    let delMov = await client.query('DELETE FROM movimentacoes_estoque WHERE sku_id = ANY($1)', [ids]);
    console.log(`- ${delMov.rowCount} movimentações deletadas.`);
    console.log(`- ${delMov.rowCount} movimentações deletadas.`);

    // 3. Deletar conferencias
    let delConf = await client.query('DELETE FROM conferencias WHERE sku_id = ANY($1)', [ids]);
    console.log(`- ${delConf.rowCount} conferências deletadas.`);

    // 4. Deletar da tabela skus
    let delSkus = await client.query('DELETE FROM skus WHERE id = ANY($1)', [ids]);
    console.log(`- ${delSkus.rowCount} SKUs excluídos com sucesso.`);

    await client.query('COMMIT');
    console.log('\nTransação concluída. Exclusão feita com segurança.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao deletar SKUs:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
