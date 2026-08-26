const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'Produtos.csv');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || 'tebarrot',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
});

async function importarCsv() {
  console.log('Iniciando importação de Produtos.csv...');

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Arquivo não encontrado: ${CSV_PATH}`);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) {
    console.error('Arquivo vazio.');
    process.exit(1);
  }

  const client = await pool.connect();
  let skusCriados = 0;
  let skusAtualizados = 0;
  let mapCriados = 0;
  let mapAtualizados = 0;

  try {
    await client.query('BEGIN');

    // Skip the first line if it's the header (SKU;PRODUTO)
    // using regex because of potential BOM at the beginning of the string
    const startIndex = lines[0].toUpperCase().includes('SKU;') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const sepIndex = line.indexOf(';');
      
      if (sepIndex === -1) {
        console.warn(`Linha inválida ignorada: ${line}`);
        continue;
      }

      // We might have BOM character on the first line if startIndex is 0
      let skuOriginal = line.substring(0, sepIndex).trim();
      skuOriginal = skuOriginal.replace(/^\uFEFF/, '');
      const produtoNome = line.substring(sepIndex + 1).trim();

      if (!skuOriginal) continue;

      let targetSkuId;

      // 1. Procurar ou Criar SKU na tabela skus
      const skuRes = await client.query('SELECT id FROM skus WHERE sku = $1 LIMIT 1', [skuOriginal]);
      if (skuRes.rows.length > 0) {
        targetSkuId = skuRes.rows[0].id;
        // Atualizar o nome (descricao) apenas se estiver em branco, ou sempre? 
        // Vamos sempre usar a descricao mais recente do Upseller/ERP
        await client.query('UPDATE skus SET descricao = $1 WHERE id = $2', [produtoNome, targetSkuId]);
        skusAtualizados++;
      } else {
        const insSku = await client.query(
          'INSERT INTO skus (produto_id, sku, descricao, volumes_por_camada) VALUES (NULL, $1, $2, 1) RETURNING id',
          [skuOriginal, produtoNome]
        );
        targetSkuId = insSku.rows[0].id;
        skusCriados++;
      }

      // 2. Procurar ou Criar mapeamento_anuncios_sku
      const mapRes = await client.query('SELECT id FROM mapeamento_anuncios_sku WHERE sku_erp = $1 LIMIT 1', [skuOriginal]);
      if (mapRes.rows.length > 0) {
        const mapId = mapRes.rows[0].id;
        await client.query(
          'UPDATE mapeamento_anuncios_sku SET sku_id = $1, nome_anuncio = $2, ativo = TRUE WHERE id = $3',
          [targetSkuId, produtoNome, mapId]
        );
        mapAtualizados++;
      } else {
        await client.query(
          'INSERT INTO mapeamento_anuncios_sku (sku_erp, nome_anuncio, sku_id, ativo) VALUES ($1, $2, $3, TRUE)',
          [skuOriginal, produtoNome, targetSkuId]
        );
        mapCriados++;
      }
    }

    await client.query('COMMIT');
    console.log('\n=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===');
    console.log(`SKUs Criados: ${skusCriados}`);
    console.log(`SKUs Atualizados (já existiam): ${skusAtualizados}`);
    console.log(`Mapeamentos Criados: ${mapCriados}`);
    console.log(`Mapeamentos Atualizados (já existiam): ${mapAtualizados}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro durante a importação. Transação revertida.', error);
  } finally {
    client.release();
    await pool.end();
  }
}

importarCsv();
