/**
 * Importação da planilha "Todos Anúncios Ativos" (PLANILHA_TODOS_ANUNCIOS.xlsx).
 *
 * Objetivo:
 *   - Cadastrar Produto Pai (quando houver SPU) ou produto avulso.
 *   - Cadastrar SKU único para cada linha ativa.
 *   - Criar mapeamento anúncio -> SKU para posterior importação de vendas.
 *
 * Estrutura esperada da planilha (colunas 0-indexed):
 *   0: SKU
 *   1: SPU (código do produto pai)
 *   2: Código do Produto
 *   3: Título
 *   ...
 *   18: O produto está ativo (Y/N)
 *   ...
 *
 * Uso:
 *   node scripts/importar_todos_anuncios.js
 *
 * O script é idempotente: se o SKU já existir, atualiza os dados;
 * se o mapeamento já existir, não duplica.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

const PLANILHA_PATH = path.join(__dirname, '..', 'PLANILHA_TODOS_ANUNCIOS.xlsx');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || 'tebarrot',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
});

/**
 * Extrai a cor do título quando ele começa com "Cor:".
 * Ex: "Cor:Linho Areia" -> "Linho Areia"
 * Ex: "Cor: Off White com Amêndoa" -> "Off White com Amêndoa"
 */
function extrairCorDoTitulo(titulo) {
  if (!titulo) return null;
  const texto = String(titulo).trim();
  if (texto.startsWith('Cor:')) {
    return texto.slice(4).trim();
  }
  return null;
}

/**
 * Normaliza o nome do Produto Pai a partir do SPU ou do título.
 */
function nomeProdutoPai(spu, titulo) {
  if (spu && String(spu).trim()) {
    return String(spu).trim();
  }
  const cor = extrairCorDoTitulo(titulo);
  const texto = String(titulo || '').trim();
  if (cor && texto.toLowerCase().startsWith('cor:')) {
    // Remove o prefixo "Cor:" para usar como nome do pai
    return texto.slice(4).trim();
  }
  return texto || 'Produto Importado';
}

/**
 * Converte valor monetário brasileiro para número.
 */
function parseDinheiro(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const numero = parseFloat(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

/**
 * Converte valor numérico, tratando vazio como null.
 */
function parseInteiro(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = parseInt(String(valor).trim(), 10);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

async function importar() {
  console.log('Iniciando importação da planilha Todos Anúncios Ativos...');

  if (!fs.existsSync(PLANILHA_PATH)) {
    console.error(`Planilha não encontrada em: ${PLANILHA_PATH}`);
    process.exitCode = 1;
    return;
  }

  const workbook = XLSX.readFile(PLANILHA_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (linhas.length < 2) {
    console.error('Planilha sem dados.');
    process.exitCode = 1;
    return;
  }

  // Ignora cabeçalho
  const dadosLinhas = linhas.slice(1);

  // Filtra apenas produtos ativos (coluna 18 = "O produto está ativo")
  const linhasAtivas = dadosLinhas.filter((linha) => {
    const ativo = String(linha[18] || '').trim().toUpperCase();
    return ativo === 'Y';
  });

  console.log(`Total de linhas: ${dadosLinhas.length}`);
  console.log(`Linhas ativas: ${linhasAtivas.length}`);

  const client = await pool.connect();
  let ok = true;

  try {
    await client.query('BEGIN');

    // Cache de Produtos Pais já criados/consultados nesta importação
    const paisCache = new Map(); // chave: nomePai -> id

    // Estatísticas
    let paisCriados = 0;
    let paisExistentes = 0;
    let skusCriados = 0;
    let skusAtualizados = 0;
    let mapeamentosCriados = 0;
    let mapeamentosExistentes = 0;

    for (const linha of linhasAtivas) {
      // Colunas principais
      const skuCodigo = linha[0] ? String(linha[0]).trim() : null;
      const spu = linha[1] ? String(linha[1]).trim() : null;
      const codigoProduto = linha[2] ? String(linha[2]).trim() : null;
      const titulo = linha[3] ? String(linha[3]).trim() : null;
      const precoVarejo = parseDinheiro(linha[20]); // coluna 20: Preço de varejo
      const custoCompra = parseDinheiro(linha[21]); // coluna 21: Custo de Compra
      const marca = linha[23] ? String(linha[23]).trim() : null; // coluna 23: Marca
      const codigoBarras = linha[25] ? String(linha[25]).trim() : null; // coluna 25: Código de Barras
      const pesoG = parseInteiro(linha[28]); // coluna 28: Peso (g)
      const comprimentoCm = parseDinheiro(linha[29]); // coluna 29: Comprimento (cm)
      const larguraCm = parseDinheiro(linha[30]); // coluna 30: Largura (cm)
      const alturaCm = parseDinheiro(linha[31]); // coluna 31: Altura (cm)
      const ncm = linha[32] ? String(linha[32]).trim() : null; // coluna 32: NCM
      const cest = linha[33] ? String(linha[33]).trim() : null; // coluna 33: CEST
      const unidade = linha[34] ? String(linha[34]).trim() : null; // coluna 34: Unidade

      if (!skuCodigo || !titulo) {
        console.warn(`Linha ignorada (SKU ou título vazio): ${JSON.stringify(linha)}`);
        continue;
      }

      // Determina nome do Produto Pai
      const nomePai = nomeProdutoPai(spu, titulo);
      const cor = extrairCorDoTitulo(titulo);
      const descricao = cor ? titulo : titulo;

      // Busca ou cria Produto Pai
      let produtoId = paisCache.get(nomePai);
      if (!produtoId) {
        const resultado = await client.query(
          'SELECT id FROM produtos WHERE nome = $1 LIMIT 1',
          [nomePai]
        );
        if (resultado.rows.length > 0) {
          produtoId = resultado.rows[0].id;
          paisExistentes++;
        } else {
          const insertResult = await client.query(
            `INSERT INTO produtos (nome, marca, categoria, peso_kg, dimensoes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
              nomePai,
              marca,
              null, // categoria
              pesoG ? pesoG / 1000 : null, // converte g para kg
              [comprimentoCm, larguraCm, alturaCm].filter((v) => v !== null).join('x') || null,
            ]
          );
          produtoId = insertResult.rows[0].id;
          paisCriados++;
        }
        paisCache.set(nomePai, produtoId);
      }

      // Busca ou cria SKU
      const skuExistente = await client.query(
        'SELECT id FROM skus WHERE sku = $1 LIMIT 1',
        [skuCodigo]
      );

      if (skuExistente.rows.length > 0) {
        // Atualiza SKU existente
        const skuId = skuExistente.rows[0].id;
        await client.query(
          `UPDATE skus
           SET produto_id = $1,
               descricao = $2,
               cor = $3,
               custo_medio = COALESCE($4, custo_medio),
               preco_venda = COALESCE($5, preco_venda),
               codigo_barras_ean = COALESCE($6, codigo_barras_ean),
               updated_at = now()
           WHERE id = $7`,
          [
            produtoId,
            descricao,
            cor,
            custoCompra,
            precoVarejo,
            codigoBarras || null,
            skuId,
          ]
        );
        skusAtualizados++;
      } else {
        const insertResult = await client.query(
          `INSERT INTO skus (produto_id, sku, descricao, cor, custo_medio, preco_venda, codigo_barras_ean, volumes_por_camada)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
           RETURNING id`,
          [
            produtoId,
            skuCodigo,
            descricao,
            cor,
            custoCompra,
            precoVarejo,
            codigoBarras || null,
          ]
        );
        skusCriados++;
      }

      // Busca o SKU id atualizado
      const skuResult = await client.query(
        'SELECT id FROM skus WHERE sku = $1 LIMIT 1',
        [skuCodigo]
      );
      const skuId = skuResult.rows[0].id;

      // Cria mapeamento anúncio -> SKU (idempotente)
      // nome_anuncio = título completo da planilha
      // variacao = cor extraída (se houver)
      const mapeamentoExistente = await client.query(
        `SELECT id FROM mapeamento_anuncios_sku
         WHERE nome_anuncio = $1
           AND COALESCE(variacao, '') = COALESCE($2, '')
         LIMIT 1`,
        [titulo, cor]
      );

      if (mapeamentoExistente.rows.length > 0) {
        // Atualiza mapeamento existente para apontar para o SKU correto
        await client.query(
          `UPDATE mapeamento_anuncios_sku
           SET sku_id = $1, ativo = TRUE, updated_at = now()
           WHERE id = $2`,
          [skuId, mapeamentoExistente.rows[0].id]
        );
        mapeamentosExistentes++;
      } else {
        await client.query(
          'INSERT INTO mapeamento_anuncios_sku (nome_anuncio, variacao, sku_id) VALUES ($1, $2, $3)',
          [titulo, cor || null, skuId]
        );
        mapeamentosCriados++;
      }
    }

    await client.query('COMMIT');

    console.log('\n=== Importação concluída com sucesso! ===');
    console.log(`Produtos Pai criados: ${paisCriados}`);
    console.log(`Produtos Pai existentes: ${paisExistentes}`);
    console.log(`SKUs criados: ${skusCriados}`);
    console.log(`SKUs atualizados: ${skusAtualizados}`);
    console.log(`Mapeamentos criados: ${mapeamentosCriados}`);
    console.log(`Mapeamentos atualizados: ${mapeamentosExistentes}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro durante a importação. Transação revertida.', err);
    ok = false;
  } finally {
    client.release();
    await pool.end();
  }

  process.exitCode = ok ? 0 : 1;
}

importar();
