const { Pool } = require('pg');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const PLANILHA_PATH = path.join(__dirname, '..', 'Mapeamento_Definitivo_MLDM_Ouro.xlsx');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || '141205',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: 'localhost',
  port: 5433,
});

async function run() {
  console.log('Iniciando Aplicação do Mapeamento Ouro...');
  
  const wb = xlsx.readFile(PLANILHA_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: null });
  
  const client = await pool.connect();
  
  let novosSkusCriados = 0;
  let skusAtualizados = 0;
  let mapeamentosCriados = 0;
  let mapeamentosAtualizados = 0;
  let movimentacoesTransferidas = 0;
  let skusOrfaosDeletados = 0;

  try {
    await client.query('BEGIN');
    
    // Remover a constraint única que impede o mesmo anúncio de ter múltiplos sku_erp (ex: ML e Shopee com o mesmo título)
    try {
        await client.query('ALTER TABLE mapeamento_anuncios_sku DROP CONSTRAINT IF EXISTS idx_mapeamento_anuncio_variacao CASCADE');
        await client.query('DROP INDEX IF EXISTS idx_mapeamento_anuncio_variacao CASCADE');
    } catch (e) {
        console.log('Aviso ao dropar constraint única: ', e.message);
    }
    
    const skuCache = {}; // novoSku -> id

    for (const row of data) {
      const skuOriginal = String(row['SKU Original'] || '').trim();
      const novoSku = String(row['NOVO SKU DEFINITIVO'] || '').trim();
      const titulo = String(row['Título Oficial (PDF ou Ref)'] || '').trim();
      const tituloUpseller = String(row['Título Upseller (Antigo)'] || '').trim();
      
      if (!skuOriginal || !novoSku) {
        continue;
      }

      // 1. Garantir que o NOVO SKU DEFINITIVO existe
      let targetSkuId = skuCache[novoSku];
      if (!targetSkuId) {
        const res = await client.query('SELECT id FROM skus WHERE sku = $1 LIMIT 1', [novoSku]);
        if (res.rows.length > 0) {
          targetSkuId = res.rows[0].id;
          await client.query('UPDATE skus SET descricao = $1 WHERE id = $2', [titulo, targetSkuId]);
          skusAtualizados++;
        } else {
          const ins = await client.query(
            'INSERT INTO skus (produto_id, sku, descricao, volumes_por_camada) VALUES (NULL, $1, $2, 1) RETURNING id',
            [novoSku, titulo]
          );
          targetSkuId = ins.rows[0].id;
          novosSkusCriados++;
        }
        skuCache[novoSku] = targetSkuId;
      }

      // 2. Conectar Anúncio (Mapeamento) e Transferir Estoque
      const mapRes = await client.query('SELECT id, sku_id FROM mapeamento_anuncios_sku WHERE sku_erp = $1 LIMIT 1', [skuOriginal]);
      
      if (mapRes.rows.length > 0) {
        const mapId = mapRes.rows[0].id;
        const oldSkuId = mapRes.rows[0].sku_id;

        // Atualiza apontamento do mapeamento
        await client.query('UPDATE mapeamento_anuncios_sku SET sku_id = $1, nome_anuncio = COALESCE(nome_anuncio, $2) WHERE id = $3', 
          [targetSkuId, tituloUpseller, mapId]
        );
        mapeamentosAtualizados++;

        // Transfere movimentações do SKU antigo para o Novo Definitivo
        if (oldSkuId && oldSkuId !== targetSkuId) {
          const updMov = await client.query(
            'UPDATE movimentacoes_estoque SET sku_id = $1 WHERE sku_id = $2 RETURNING id',
            [targetSkuId, oldSkuId]
          );
          movimentacoesTransferidas += updMov.rowCount;
        }
      } else {
        // Mapeamento não existia, vamos criá-lo
        await client.query(
          'INSERT INTO mapeamento_anuncios_sku (sku_erp, nome_anuncio, sku_id) VALUES ($1, $2, $3)',
          [skuOriginal, tituloUpseller, targetSkuId]
        );
        mapeamentosCriados++;
      }
    }

    // 3. Limpeza Final: Deletar SKUs antigos que ficaram órfãos
    // Um SKU órfão é aquele que não tem mapeamento apontando pra ele E não tem movimentações de estoque.
    const delRes = await client.query(`
      DELETE FROM skus 
      WHERE id NOT IN (SELECT DISTINCT sku_id FROM mapeamento_anuncios_sku WHERE sku_id IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT sku_id FROM movimentacoes_estoque WHERE sku_id IS NOT NULL)
    `);
    skusOrfaosDeletados = delRes.rowCount;

    const remainingRes = await client.query('SELECT COUNT(*) FROM skus');

    console.log('\n=== RESULTADO DA APLICAÇÃO (MAPEAMENTO OURO) ===');
    console.log(`Novos SKUs Definitivos Criados: ${novosSkusCriados}`);
    console.log(`SKUs Definitivos Atualizados: ${skusAtualizados}`);
    console.log(`Anúncios Upseller Reconectados: ${mapeamentosAtualizados}`);
    console.log(`Novos Anúncios Mapeados: ${mapeamentosCriados}`);
    console.log(`Lançamentos de Estoque Preservados/Migrados: ${movimentacoesTransferidas}`);
    console.log(`SKUs Antigos/Órfãos Deletados: ${skusOrfaosDeletados}`);
    console.log(`\nTotal de SKUs Físicos agora no sistema: ${remainingRes.rows[0].count}`);

    await client.query('COMMIT');
    console.log('\nTransação concluída com SUCESSO!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nErro na transação. Banco revertido para segurança:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
