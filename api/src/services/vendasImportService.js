/**
 * Service: vendasImportService
 * Processamento transacional, 100% idempotente de planilhas de vendas (Upseller / Marketplaces).
 * Suporte a decomposição de Kits (BOM), prevenção de duplicidades e auditoria por lotes.
 */
const XLSX = require('xlsx');
const db = require('../config/db');
const MapeamentoAnuncio = require('../models/MapeamentoAnuncio');
const LoteImportacaoVendas = require('../models/LoteImportacaoVendas');
const PedidoVendaImportado = require('../models/PedidoVendaImportado');
const ledgerService = require('./ledgerService');

async function processarArquivoVendas({ fileBuffer, nomeArquivo, armazemId, usuarioId }) {
  if (!fileBuffer) {
    const err = new Error('Arquivo .xlsx ou .csv é obrigatório.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  if (!armazemId) {
    const err = new Error('Selecione exatamente 1 armazém de expedição.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const dadosLinhas = XLSX.utils.sheet_to_json(sheet);

  if (!dadosLinhas || dadosLinhas.length === 0) {
    const err = new Error('Planilha sem dados ou formato não reconhecido.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  return db.withTransaction(async (client) => {
    // Cria o lote inicial
    const lote = await LoteImportacaoVendas.create(
      {
        nome_arquivo: nomeArquivo || 'vendas.xlsx',
        total_linhas: dadosLinhas.length,
        processados: 0,
        nao_mapeados: 0,
        erros: 0,
        armazem_id: armazemId,
        usuario_id: usuarioId,
      },
      client
    );

    const processados = [];
    const naoMapeados = [];
    const duplicados = [];
    const erros = [];

    for (const linha of dadosLinhas) {
      // Compatibilidade de cabeçalhos de múltiplos formatos (Upseller, ML, Tiny, Bling)
      const numeroPedido = String(
        linha['N° de Pedido'] ||
        linha['Número do Pedido'] ||
        linha['Pedido'] ||
        linha['Numero Pedido'] ||
        linha['order_id'] ||
        ''
      ).trim();

      const plataforma = String(
        linha['Plataformas'] ||
        linha['Canal'] ||
        linha['Marketplace'] ||
        linha['Origem'] ||
        'Upseller'
      ).trim();

      const nomeAnuncio = String(
        linha['Nome do Anúncio'] ||
        linha['Título'] ||
        linha['Anúncio'] ||
        linha['Produto'] ||
        ''
      ).trim();

      const skuErp = String(
        linha['SKU'] ||
        linha['SKU ERP'] ||
        linha['Código'] ||
        linha['Item SKU'] ||
        ''
      ).trim();

      const variacao = linha['Variação'] || linha['Variacao'] ? String(linha['Variação'] || linha['Variacao']).trim() : null;

      const qtdRaw = linha['Qtd. do Produto'] ?? linha['Quantidade'] ?? linha['Qtd'] ?? linha['quantity'];
      const qtdVendida = parseInt(qtdRaw, 10);

      if (!skuErp && !nomeAnuncio) {
        erros.push({ linha, motivo: 'Linha sem SKU e sem Nome de Anúncio.' });
        continue;
      }

      if (isNaN(qtdVendida) || qtdVendida <= 0) {
        erros.push({ linha, motivo: `Quantidade inválida: ${qtdRaw}` });
        continue;
      }

      // 1. CHECAGEM DE IDEMPOTÊNCIA (Evita reprocessar o mesmo pedido do mesmo armazém)
      if (numeroPedido) {
        const jaProcessado = await PedidoVendaImportado.findByPedido(numeroPedido, skuErp, armazemId, client);
        if (jaProcessado) {
          duplicados.push({
            numeroPedido,
            skuErp,
            nomeAnuncio,
            motivo: 'Pedido já importado e baixado anteriormente.',
          });
          continue;
        }
      }

      // 2. BUSCA DO MAPEAMENTO (SKU_ERP -> Auto-heal -> Anúncio)
      let mapeamento = null;
      if (skuErp) {
        mapeamento = await MapeamentoAnuncio.findBySkuErp(skuErp, client);
      }

      // Fallback 1: se o SKU do ERP for idêntico a um código da tabela skus
      if (!mapeamento && skuErp) {
        const skuRes = await client.query('SELECT id, sku, descricao FROM skus WHERE sku = $1 AND ativo = TRUE LIMIT 1', [skuErp]);
        if (skuRes.rows.length > 0) {
          const skuData = skuRes.rows[0];
          // Auto-heal: cria o mapeamento
          const novoMap = await client.query(
            `INSERT INTO mapeamento_anuncios_sku (sku_erp, nome_anuncio, sku_id, ativo)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (sku_erp) DO UPDATE SET sku_id = EXCLUDED.sku_id
             RETURNING *`,
            [skuErp, nomeAnuncio || skuData.descricao, skuData.id]
          );

          await client.query(
            `INSERT INTO mapeamento_anuncio_itens (mapeamento_id, sku_id, quantidade)
             VALUES ($1, $2, 1)
             ON CONFLICT (mapeamento_id, sku_id) DO NOTHING`,
            [novoMap.rows[0].id, skuData.id]
          );

          mapeamento = {
            id: novoMap.rows[0].id,
            sku_id: skuData.id,
            sku: skuData.sku,
            sku_descricao: skuData.descricao,
            itens: [{ sku_id: skuData.id, sku: skuData.sku, sku_descricao: skuData.descricao, quantidade: 1 }],
          };
        }
      }

      // Fallback 2: busca por Nome do Anúncio + Variação
      if (!mapeamento && nomeAnuncio) {
        mapeamento = await MapeamentoAnuncio.findByAnuncio(nomeAnuncio, variacao, client);
      }

      // 3. NÃO MAPEADO
      if (!mapeamento || !mapeamento.itens || mapeamento.itens.length === 0) {
        await PedidoVendaImportado.create(
          {
            lote_id: lote.id,
            numero_pedido: numeroPedido || 'S/N',
            plataforma,
            sku_erp: skuErp || 'S/SKU',
            nome_anuncio: nomeAnuncio,
            variacao,
            quantidade: qtdVendida,
            armazem_id: armazemId,
            status: 'nao_mapeado',
            motivo_erro: 'SKU ou Anúncio não mapeado no sistema.',
          },
          client
        );

        naoMapeados.push({
          numeroPedido,
          nomeAnuncio,
          skuErp,
          qtdVendida,
          variacao,
        });
        continue;
      }

      // 4. PROCESSA AS BAIXAS NO LEDGER COM DECOMPOSIÇÃO DE KITS (BOM)
      try {
        for (const itemComponente of mapeamento.itens) {
          const qtdBaixaTotal = -(qtdVendida * (itemComponente.quantidade || 1));
          const observacao = `Venda ${numeroPedido || 'S/N'} - ${plataforma}${mapeamento.itens.length > 1 ? ` (Kit comp: ${itemComponente.sku})` : ''}`.slice(0, 255);

          const movimentacao = await ledgerService.registrarMovimentacao(
            {
              skuId: itemComponente.sku_id,
              armazemId,
              tipo: 'saida',
              quantidade: qtdBaixaTotal,
              idOperador: usuarioId,
              observacao,
            },
            client
          );

          // Atualiza lote_id e motivo_ajuste na movimentacao
          await client.query(
            `UPDATE movimentacoes_estoque
             SET lote_id = $1, motivo_ajuste = 'venda_ecommerce'
             WHERE id = $2`,
            [lote.id, movimentacao.id]
          );

          await PedidoVendaImportado.create(
            {
              lote_id: lote.id,
              numero_pedido: numeroPedido || 'S/N',
              plataforma,
              sku_erp: skuErp || itemComponente.sku,
              nome_anuncio: nomeAnuncio,
              variacao,
              quantidade: qtdVendida,
              armazem_id: armazemId,
              sku_id: itemComponente.sku_id,
              movimentacao_id: movimentacao.id,
              status: 'processado',
            },
            client
          );

          processados.push({
            numeroPedido,
            nomeAnuncio,
            variacao,
            sku: itemComponente.sku,
            skuDescricao: itemComponente.sku_descricao,
            qtdVendida: Math.abs(qtdBaixaTotal),
            armazemId,
            movimentacaoId: movimentacao.id,
          });
        }
      } catch (errBaixa) {
        console.error(`Erro ao dar baixa no pedido ${numeroPedido}:`, errBaixa);
        await PedidoVendaImportado.create(
          {
            lote_id: lote.id,
            numero_pedido: numeroPedido || 'S/N',
            plataforma,
            sku_erp: skuErp || 'S/SKU',
            nome_anuncio: nomeAnuncio,
            variacao,
            quantidade: qtdVendida,
            armazem_id: armazemId,
            status: 'erro',
            motivo_erro: errBaixa.message,
          },
          client
        );
        erros.push({ numeroPedido, skuErp, motivo: errBaixa.message });
      }
    }

    // 5. ATUALIZA OS CONTADORES DO LOTE
    await client.query(
      `UPDATE lotes_importacao_vendas
       SET processados = $1, nao_mapeados = $2, erros = $3, updated_at = now()
       WHERE id = $4`,
      [processados.length, naoMapeados.length, erros.length, lote.id]
    );

    // 6. GERA PLANILHA DE RETORNO EM CASO DE ERROS OU NÃO MAPEADOS
    let arquivoErrosBase64 = null;
    if (erros.length > 0 || naoMapeados.length > 0 || duplicados.length > 0) {
      const wb = XLSX.utils.book_new();

      if (naoMapeados.length > 0) {
        const wsNaoMapeados = XLSX.utils.json_to_sheet(
          naoMapeados.map((n) => ({
            'N° de Pedido': n.numeroPedido || '',
            'Nome do Anúncio': n.nomeAnuncio || '',
            'SKU ERP': n.skuErp || '',
            'Qtd. Vendida': n.qtdVendida || 0,
            'Variação': n.variacao || '',
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsNaoMapeados, 'Não Mapeados');
      }

      if (duplicados.length > 0) {
        const wsDuplicados = XLSX.utils.json_to_sheet(
          duplicados.map((d) => ({
            'N° de Pedido': d.numeroPedido || '',
            'SKU ERP': d.skuErp || '',
            'Nome do Anúncio': d.nomeAnuncio || '',
            'Motivo': d.motivo || '',
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsDuplicados, 'Já Importados');
      }

      if (erros.length > 0) {
        const wsErros = XLSX.utils.json_to_sheet(
          erros.map((e) => ({
            'N° de Pedido': e.numeroPedido || '',
            'SKU ERP': e.skuErp || '',
            'Motivo': e.motivo || '',
          }))
        );
        XLSX.utils.book_append_sheet(wb, wsErros, 'Erros');
      }

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      arquivoErrosBase64 = buffer.toString('base64');
    }

    return {
      loteId: lote.id,
      resumo: {
        totalLinhas: dadosLinhas.length,
        processados: processados.length,
        naoMapeados: naoMapeados.length,
        duplicados: duplicados.length,
        erros: erros.length,
      },
      processados,
      naoMapeados,
      duplicados,
      erros,
      arquivoErrosBase64,
    };
  });
}

module.exports = {
  processarArquivoVendas,
};
