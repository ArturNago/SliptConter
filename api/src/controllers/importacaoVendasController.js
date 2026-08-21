/**
 * Importação de saídas de estoque a partir da planilha Export_Order (UpSeller).
 *
 * O arquivo .xlsx é lido em memória (multer memoryStorage), sem salvar em disco.
 * Cada linha é casada com um mapeamento anúncio → SKU.
 * Se o mapeamento existir, registra uma saída no ledger.
 * Se não existir, adiciona à lista de não mapeados (retorna ao usuário).
 *
 * Regras de quantidade:
 *   - quantidade de saída = Qtd. do Produto (coluna 7, 0-indexed) × (-1)
 *   - Um movimento por armazém selecionado × por linha da planilha.
 *
 * Body (multipart/form-data):
 *   arquivo   : File (.xlsx)
 *   armazemIds: JSON string array de UUIDs — ex: '["uuid1","uuid2"]'
 */
const XLSX = require('xlsx');
const MapeamentoAnuncio = require('../models/MapeamentoAnuncio');
const ledgerService = require('../services/ledgerService');

async function importar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo .xlsx é obrigatório.' });
    }

    // armazemIds pode vir como string JSON ou como array (multipart)
    let armazemIds;
    try {
      armazemIds = typeof req.body.armazemIds === 'string'
        ? JSON.parse(req.body.armazemIds)
        : req.body.armazemIds;
    } catch {
      return res.status(400).json({ erro: 'armazemIds deve ser um array JSON de UUIDs.' });
    }

    if (!Array.isArray(armazemIds) || armazemIds.length === 0) {
      return res.status(400).json({ erro: 'Selecione ao menos um armazém.' });
    }

    // Lê o xlsx da memória
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const dadosLinhas = XLSX.utils.sheet_to_json(sheet);

    if (dadosLinhas.length === 0) {
      return res.status(400).json({ erro: 'Planilha sem dados ou formato inválido.' });
    }

    const processados = [];
    const naoMapeados = [];
    const erros = [];

    for (const linha of dadosLinhas) {
      // Busca pelas chaves do cabeçalho da planilha Upseller
      const numeroPedido  = String(linha['N° de Pedido'] || '').trim();
      const plataforma    = String(linha['Plataformas'] || '').trim();
      const nomeAnuncio   = String(linha['Nome do Anúncio'] || '').trim();
      const skuErp        = String(linha['SKU'] || '').trim();
      const variacao      = linha['Variação'] ? String(linha['Variação']).trim() : null;
      const qtdVendida    = parseInt(linha['Qtd. do Produto'], 10);

      if (!skuErp || isNaN(qtdVendida) || qtdVendida <= 0) {
        erros.push({ linha: linha, motivo: 'Dados inválidos (SKU vazio ou quantidade inválida).' });
        continue;
      }

      let mapeamento = await MapeamentoAnuncio.findBySkuErp(skuErp);

      if (!mapeamento) {
        // Fallback: se o código Upseller for idêntico a um código da tabela skus, usa e cria o mapeamento automaticamente
        const db = require('../config/db');
        const skuRes = await db.query('SELECT id, sku, descricao FROM skus WHERE sku = $1 LIMIT 1', [skuErp]);
        
        if (skuRes.rows.length > 0) {
          const skuData = skuRes.rows[0];
          
          // Auto-heal: cria o mapeamento para usos futuros
          await db.query(
            'INSERT INTO mapeamento_anuncios_sku (sku_erp, nome_anuncio, sku_id, ativo) VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING',
            [skuErp, nomeAnuncio || skuData.descricao, skuData.id]
          );

          mapeamento = {
            sku_id: skuData.id,
            sku: skuData.sku,
            sku_descricao: skuData.descricao,
          };
        }
      }

      if (!mapeamento) {
        naoMapeados.push({
          numeroPedido,
          nomeAnuncio,
          skuErp,
          qtdVendida,
          variacao,
        });
        continue;
      }

      // Registra uma saída por armazém selecionado
      for (const armazemId of armazemIds) {
        try {
          const movimentacao = await ledgerService.registrarMovimentacao({
            skuId:       mapeamento.sku_id,
            armazemId,
            tipo:        'saida',
            quantidade:  -(qtdVendida),
            idOperador:  req.usuario.id,
            observacao:  `Venda ${numeroPedido} - ${plataforma}`.slice(0, 255),
          });
          processados.push({
            numeroPedido,
            nomeAnuncio,
            variacao,
            sku: mapeamento.sku,
            skuDescricao: mapeamento.sku_descricao,
            qtdVendida,
            armazemId,
            movimentacaoId: movimentacao.id,
          });
        } catch (errMov) {
          console.error(`Erro ao baixar SKU ${skuErp}: ${errMov.message}`);
          erros.push({
            numeroPedido,
            nomeAnuncio,
            skuErp,
            armazemId,
            motivo: errMov.message,
          });
        }
      }
    }

    // Gera planilha de não sincronizados quando houver erros ou não mapeados
    let arquivoErrosBase64 = null;
    if (erros.length > 0 || naoMapeados.length > 0) {
      const wb = XLSX.utils.book_new();

      if (erros.length > 0) {
        const wsErros = XLSX.utils.json_to_sheet(
          erros.map((e) => ({
            'N° de Pedido': e.numeroPedido || '',
            'Nome do Anúncio': e.nomeAnuncio || '',
            'SKU ERP': e.skuErp || '',
            'Armazém': e.armazemId || '',
            'Motivo': e.motivo || '',
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsErros, 'Erros');
      }

      if (naoMapeados.length > 0) {
        const wsNaoMapeados = XLSX.utils.json_to_sheet(
          naoMapeados.map((n) => ({
            'N° de Pedido': n.numeroPedido || '',
            'Nome do Anúncio': n.nomeAnuncio || '',
            'SKU ERP': n.skuErp || '',
            'Qtd. Vendida': n.qtdVendida || 0,
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsNaoMapeados, 'Não Mapeados');
      }

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      arquivoErrosBase64 = buffer.toString('base64');
    }

    return res.json({
      resumo: {
        totalLinhas:    dadosLinhas.length,
        processados:    processados.length,
        naoMapeados:    naoMapeados.length,
        erros:          erros.length,
      },
      processados,
      naoMapeados,
      erros,
      arquivoErrosBase64,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { importar };
