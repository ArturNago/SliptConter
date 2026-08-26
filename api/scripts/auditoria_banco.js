const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});

async function run() {
  const client = await pool.connect();
  const relatorio = [];

  // 1. SKUs com código PROD- sem nenhum mapeamento
  let res = await client.query(`
    SELECT sku, descricao FROM skus
    WHERE sku LIKE 'PROD-%'
    AND id NOT IN (SELECT DISTINCT sku_id FROM mapeamento_anuncios_sku WHERE sku_id IS NOT NULL)
  `);
  relatorio.push({ titulo: `⚠️  SKUs com código PROD- sem nenhum anúncio mapeado (${res.rows.length})`, rows: res.rows });

  // 2. SKUs com descrição duplicada
  res = await client.query(`
    SELECT descricao, COUNT(*) as qtd, ARRAY_AGG(sku) as skus
    FROM skus GROUP BY descricao HAVING COUNT(*) > 1
  `);
  relatorio.push({ titulo: `⚠️  SKUs com MESMA DESCRIÇÃO (possível duplicata) (${res.rows.length})`, rows: res.rows });

  // 3. SKUs totalmente órfãos (sem mapeamento E sem movimentação)
  res = await client.query(`
    SELECT s.sku, s.descricao FROM skus s
    WHERE s.id NOT IN (SELECT DISTINCT sku_id FROM mapeamento_anuncios_sku WHERE sku_id IS NOT NULL)
    AND s.id NOT IN (SELECT DISTINCT sku_id FROM movimentacoes_estoque WHERE sku_id IS NOT NULL)
  `);
  relatorio.push({ titulo: `🗑️  SKUs totalmente ÓRFÃOS (sem anúncio e sem estoque) (${res.rows.length})`, rows: res.rows });

  // 4. Mapeamentos com nome_anuncio vazio ou nulo
  res = await client.query(`
    SELECT sku_erp, nome_anuncio, sku_id FROM mapeamento_anuncios_sku
    WHERE nome_anuncio IS NULL OR nome_anuncio = ''
  `);
  relatorio.push({ titulo: `⚠️  Mapeamentos sem nome de anúncio (${res.rows.length})`, rows: res.rows });

  // 5. Mapeamentos com nome genérico tipo "Cor: Amêndoa"
  res = await client.query(`
    SELECT sku_erp, nome_anuncio FROM mapeamento_anuncios_sku
    WHERE nome_anuncio ~* '^Cor:'
    LIMIT 20
  `);
  relatorio.push({ titulo: `⚠️  Mapeamentos com nome tipo 'Cor:Amêndoa' (genérico) (${res.rows.length} primeiros)`, rows: res.rows });

  // 6. SKUs com saldo de estoque NEGATIVO
  res = await client.query(`
    SELECT s.sku, s.descricao,
      SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
               WHEN m.tipo = 'saida' THEN -m.quantidade
               ELSE 0 END) as saldo
    FROM skus s
    JOIN movimentacoes_estoque m ON s.id = m.sku_id
    GROUP BY s.id, s.sku, s.descricao
    HAVING SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
                    WHEN m.tipo = 'saida' THEN -m.quantidade
                    ELSE 0 END) < 0
  `);
  relatorio.push({ titulo: `🔴  SKUs com SALDO NEGATIVO (${res.rows.length})`, rows: res.rows });

  // 7. SKUs com saldo de estoque MUITO ALTO (acima de 500 un - provavelmente erro de importação)
  res = await client.query(`
    SELECT s.sku, s.descricao,
      SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
               WHEN m.tipo = 'saida' THEN -m.quantidade
               ELSE 0 END) as saldo
    FROM skus s
    JOIN movimentacoes_estoque m ON s.id = m.sku_id
    GROUP BY s.id, s.sku, s.descricao
    HAVING SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
                    WHEN m.tipo = 'saida' THEN -m.quantidade
                    ELSE 0 END) > 500
    ORDER BY saldo DESC
  `);
  relatorio.push({ titulo: `🔴  SKUs com SALDO SUSPEITO (acima de 500 unidades) (${res.rows.length})`, rows: res.rows });

  // 8. SKUs com nome/código claramente de teste ou inválido
  res = await client.query(`
    SELECT sku, descricao FROM skus
    WHERE sku IN ('AGU-500ML-12', 'ARR-5KG-T1', 'FEI-1KG-P', 'POL-UXUÁ')
       OR descricao ILIKE '%arroz%'
       OR descricao ILIKE '%feijão%'
       OR descricao ILIKE '%água mineral%'
  `);
  relatorio.push({ titulo: `🗑️  SKUs de TESTE/FICTÍCIOS detectados (${res.rows.length})`, rows: res.rows });

  // 9. Mapeamentos duplicados por sku_erp
  res = await client.query(`
    SELECT sku_erp, COUNT(*) as qtd, ARRAY_AGG(nome_anuncio) as anuncios
    FROM mapeamento_anuncios_sku GROUP BY sku_erp HAVING COUNT(*) > 1
    LIMIT 10
  `);
  relatorio.push({ titulo: `⚠️  SKU ERP com mais de um mapeamento (mesmo SKU, dois anúncios) (${res.rows.length})`, rows: res.rows });

  // 10. Saldo geral de estoque por SKU (top 20 com estoque)
  res = await client.query(`
    SELECT s.sku, s.descricao,
      SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
               WHEN m.tipo = 'saida' THEN -m.quantidade
               ELSE 0 END) as saldo
    FROM skus s
    JOIN movimentacoes_estoque m ON s.id = m.sku_id
    GROUP BY s.id, s.sku, s.descricao
    HAVING SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
                    WHEN m.tipo = 'saida' THEN -m.quantidade
                    ELSE 0 END) > 0
    ORDER BY saldo DESC
    LIMIT 20
  `);
  relatorio.push({ titulo: `✅  TOP 20 SKUs com estoque positivo`, rows: res.rows });

  // Imprimir
  for (const item of relatorio) {
    console.log('\n' + '═'.repeat(70));
    console.log(item.titulo);
    console.log('═'.repeat(70));
    if (item.rows.length === 0) {
      console.log('  (Nenhum registro encontrado)');
    } else {
      item.rows.forEach(r => console.log(' ', JSON.stringify(r)));
    }
  }

  client.release();
  await pool.end();
}

run().catch(console.error);
