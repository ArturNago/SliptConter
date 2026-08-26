const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Iniciando correção das irregularidades finais...');

    // 1. Corrigir a duplicata: "Bibox matrix 3 em 1 Branco"
    // SKUs envolvidos: BIBO-MATR-BRAN (Canônico, da planilha Ouro) e PROD-MSHR5UO8 (antigo)
    console.log('\n--- Corrigindo Duplicata: Bibox matrix 3 em 1 Branco ---');
    const canonRes = await client.query("SELECT id FROM skus WHERE sku = 'BIBO-MATR-BRAN'");
    const dupRes = await client.query("SELECT id FROM skus WHERE sku = 'PROD-MSHR5UO8'");

    if (canonRes.rows.length > 0 && dupRes.rows.length > 0) {
      const canonId = canonRes.rows[0].id;
      const dupId = dupRes.rows[0].id;

      // Transferir mapeamentos
      const updMap = await client.query("UPDATE mapeamento_anuncios_sku SET sku_id = $1 WHERE sku_id = $2 RETURNING id", [canonId, dupId]);
      console.log(`Mapeamentos transferidos: ${updMap.rowCount}`);

      // Transferir movimentações
      const updMov = await client.query("UPDATE movimentacoes_estoque SET sku_id = $1 WHERE sku_id = $2 RETURNING id", [canonId, dupId]);
      console.log(`Movimentações de estoque transferidas: ${updMov.rowCount}`);
      
      // Transferir conferencias (foreign key check)
      const updConf = await client.query("UPDATE conferencias SET sku_id = $1 WHERE sku_id = $2 RETURNING id", [canonId, dupId]);
      console.log(`Registros de conferencias transferidos: ${updConf.rowCount}`);

      // Deletar o duplicado
      await client.query("DELETE FROM skus WHERE id = $1", [dupId]);
      console.log(`SKU duplicado PROD-MSHR5UO8 deletado.`);
    } else {
      console.log('Duplicata já resolvida ou SKUs não encontrados.');
    }

    // 2. Corrigir SKU com acentuação (POL-UXUÁ -> POL-UXUA)
    console.log('\n--- Corrigindo SKU com Acentuação ---');
    const uxuRes = await client.query("UPDATE skus SET sku = 'POL-UXUA' WHERE sku = 'POL-UXUÁ' RETURNING id");
    if (uxuRes.rowCount > 0) {
       console.log('SKU POL-UXUÁ renomeado para POL-UXUA.');
    } else {
       console.log('SKU POL-UXUÁ não encontrado (já corrigido?).');
    }

    await client.query('COMMIT');
    console.log('\nCorreções aplicadas com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao aplicar correções:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
