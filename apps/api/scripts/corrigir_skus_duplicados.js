const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || '141205',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: 'localhost',
  port: 5433,
});

function normalizeDesc(desc) {
  if (!desc) return '';
  let s = desc.toLowerCase();
  s = s.replace(/cor:/g, ' ');
  s = s.replace(/-/g, ' ');
  s = s.replace(/\//g, ' ');
  s = s.replace(/minha loja de móveis/g, ' ');
  s = s.replace(/mldm/g, ' ');
  s = s.replace(/tebarrot/g, ' ');
  s = s.replace(/para sala/g, ' ');
  s = s.replace(/p\/ sala/g, ' ');
  s = s.replace(/para hall/g, ' ');
  s = s.replace(/de estar/g, ' ');
  s = s.replace(/com pés/g, ' ');
  s = s.replace(/da sala/g, ' ');
  s = s.replace(/quarto/g, ' ');
  
  // split into words, remove empty, filter out short words if they aren't numbers
  let words = s.split(/\s+/).filter(w => w.length > 0);
  
  // Sort alphabetically to handle "Buffet Nature" vs "Nature Buffet"
  words.sort();
  
  return words.join(' ');
}

async function run() {
  console.log('Iniciando deduplicação por normalização de string...');
  const client = await pool.connect();

  let skusMantidos = 0;
  let skusDeletados = 0;
  let movsAtualizadas = 0;
  let mapsAtualizados = 0;

  try {
    await client.query('BEGIN');

    // Buscar todos os SKUs e a contagem de movimentações
    const res = await client.query(`
      SELECT 
        s.id, 
        s.sku, 
        s.descricao, 
        (SELECT COUNT(*) FROM movimentacoes_estoque m WHERE m.sku_id = s.id) as movs
      FROM skus s
    `);
    
    const skus = res.rows;
    const grupos = {};

    for (const sku of skus) {
      // Se a descrição for literalmente "Cor: X - X", vamos tentar achar a cor?
      // O normalize já vai tratar isso: "cor:areia - areia" -> "areia areia" -> "areia areia"
      let sig = normalizeDesc(sku.descricao);
      if (!sig) sig = sku.sku; // fallback
      
      if (!grupos[sig]) {
        grupos[sig] = [];
      }
      grupos[sig].push(sku);
    }

    for (const [sig, items] of Object.entries(grupos)) {
      if (items.length <= 1) {
        skusMantidos++;
        continue;
      }

      // Ordenar por movs DESC, depois por descricao mais longa
      items.sort((a, b) => {
        if (b.movs !== a.movs) return b.movs - a.movs;
        return b.descricao.length - a.descricao.length;
      });

      const canonical = items[0];
      const duplicates = items.slice(1).map(i => i.id);

      console.log(`\n[GRUPO] ${sig}`);
      console.log(`  -> CANÔNICO: ${canonical.sku} - ${canonical.descricao} (Movs: ${canonical.movs})`);
      for (const dup of items.slice(1)) {
         console.log(`  -> DUPLICADO: ${dup.sku} - ${dup.descricao} (Movs: ${dup.movs})`);
      }

      // Update movimentacoes
      if (duplicates.length > 0) {
        const updMov = await client.query(
          'UPDATE movimentacoes_estoque SET sku_id = $1 WHERE sku_id = ANY($2) RETURNING id',
          [canonical.id, duplicates]
        );
        movsAtualizadas += updMov.rowCount;

        const updMap = await client.query(
          'UPDATE mapeamento_anuncios_sku SET sku_id = $1 WHERE sku_id = ANY($2) RETURNING id',
          [canonical.id, duplicates]
        );
        mapsAtualizados += updMap.rowCount;

        const delRes = await client.query(
          'DELETE FROM skus WHERE id = ANY($1)',
          [duplicates]
        );
        skusDeletados += delRes.rowCount;
      }
      skusMantidos++;
    }

    // Por fim, vamos atualizar o nome de alguns SKUs muito feios, como "Cor:Amêndoa - Amêndoa" para apenas "Amêndoa" (embora seja melhor não perder dados se for só isso)
    
    console.log(`\n=== RESUMO DA DEDUPLICAÇÃO ===`);
    console.log(`SKUs Canônicos Mantidos: ${skusMantidos}`);
    console.log(`SKUs Duplicados Removidos: ${skusDeletados}`);
    console.log(`Movimentações Transferidas: ${movsAtualizadas}`);
    console.log(`Mapeamentos Transferidos: ${mapsAtualizados}`);

    await client.query('COMMIT');
    console.log('Transação finalizada com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro, rollback executado:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
