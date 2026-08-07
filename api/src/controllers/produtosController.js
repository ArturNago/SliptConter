/**
 * Consulta e cadastro de produtos do estoque.
 *
 * ATENÇÃO (pós-migração 013): no app móvel, "produto" = SKU bipado.
 * Estas rotas mantêm o contrato /api/produtos, mas operam sobre a
 * tabela `skus` (com join ao Produto Pai em `produtos`).
 */
const Sku = require('../models/Sku');
const Produto = require('../models/Produto');
const db = require('../config/db');
const ledgerService = require('../services/ledgerService');

/**
 * Coerção única para campos inteiros positivos do SKU (POST e PATCH).
 * Vazio (undefined/null/'') -> null (preservado via COALESCE no update).
 * Valor inválido ou não positivo -> erro 400 exposto ao app.
 */
function coerceInteiroPositivo(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : parseInt(valor, 10);
  if (!Number.isInteger(numero) || numero <= 0) {
    const err = new Error(`Campo ${campo} deve ser um inteiro maior que zero.`);
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return numero;
}

/**
 * Coerção única para campos monetários (custoMedio/precoVenda).
 * Aceita número, '1234.56' ou '1234,56' (vírgula decimal BR).
 * Rejeita separador de milhar e valores não finitos com 400.
 */
function coerceDinheiro(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  let numero = valor;
  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!/^\d+([.,]\d{1,2})?$/.test(texto)) {
      const err = new Error(`Campo ${campo} deve ser um número válido (ex.: 1234.56), sem separador de milhar.`);
      err.status = 400;
      err.expose = true;
      throw err;
    }
    numero = texto.replace(',', '.');
  }
  const resultado = parseFloat(numero);
  if (!Number.isFinite(resultado) || resultado < 0) {
    const err = new Error(`Campo ${campo} deve ser um número maior ou igual a zero.`);
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return resultado;
}

function erroValidacao(mensagem) {
  const err = new Error(mensagem);
  err.status = 400;
  err.expose = true;
  return err;
}

/**
 * GET /api/produtos
 * Lista os SKUs ativos enriquecidos com os dados do Produto Pai.
 * Filtros opcionais: ?busca=<texto> (ILIKE em descricao/sku/nome do Pai),
 * ?limit=<n> (usado pela tela de lançamento para não baixar o catálogo inteiro).
 */
async function listar(req, res, next) {
  try {
    const { busca, limit } = req.query;
    const skus = await Sku.list({
      ativo: true,
      busca: busca ? String(busca).trim() : null,
      limit: limit ? parseInt(limit, 10) : null,
    });
    return res.json(skus);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/produtos/saldos
 * Saldo total de todos os SKUs ativos em uma única query — usado pelas
 * telas de lista/dashboard do app (substitui o N+1 de saldo por produto).
 */
async function saldosTotais(req, res, next) {
  try {
    const saldos = await ledgerService.obterSaldosTotais();
    return res.json(saldos);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/produtos/sku/:sku
 * Usado imediatamente após bipar o SKU da etiqueta da pilha.
 */
async function buscarPorSku(req, res, next) {
  try {
    const sku = await Sku.findBySkuEnriched(req.params.sku);
    if (!sku) {
      return res.status(404).json({ erro: 'Produto não encontrado para este SKU.' });
    }
    return res.json(sku);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/produtos/:id/saldo
 * `:id` é o id do SKU (é o que o app recebe de /api/produtos e /sku/:sku).
 */
async function saldo(req, res, next) {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    const { armazemId } = req.query;
    if (armazemId) {
      const saldoAtual = await ledgerService.obterSaldo(sku.id, armazemId);
      return res.json({ produtoId: sku.id, sku: sku.sku, armazemId, saldo: saldoAtual });
    }
    const porArmazemRows = await ledgerService.obterSaldoPorArmazem(sku.id);
    // Contrato consumido pelo app (useSaldoProdutos / ProdutoDetailScreen):
    // porArmazem: [{ armazemId, armazemNome, quantidade }]
    const porArmazem = porArmazemRows.map((item) => ({
      armazemId: item.armazemId,
      armazemNome: item.nome,
      quantidade: Number(item.saldo),
    }));
    return res.json({
      produtoId: sku.id,
      sku: sku.sku,
      saldoTotal: porArmazem.reduce((total, item) => total + item.quantidade, 0),
      porArmazem,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/produtos/:id/movimentacoes
 * `:id` é o id do SKU.
 */
async function movimentacoes(req, res, next) {
  try {
    const { limit, offset } = req.query;
    const historico = await ledgerService.historico(req.params.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return res.json(historico);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/produtos
 * Cadastro pelo app: cria um SKU. Se `produtoId` (Pai) não for informado,
 * cria/reutiliza automaticamente um Produto Pai com nome = descricao.
 * Pai + SKU são gravados na mesma transação (sem Pai órfão em caso de erro).
 * Restrito a gestor/admin.
 */
async function criar(req, res, next) {
  try {
    const {
      sku,
      descricao,
      volumesPorCamada,
      camadasMaximasPalete,
      quantidadeVolumes,
      categoria,
      fotoUrl,
      produtoId,
      cor,
      material,
      codigoBarrasEan,
      custoMedio,
      precoVenda,
    } = req.body;
    if (!sku || !descricao) {
      return res.status(400).json({ erro: 'sku e descricao são obrigatórios.' });
    }

    const campos = {
      volumesPorCamada: coerceInteiroPositivo(volumesPorCamada, 'volumesPorCamada'),
      camadasMaximasPalete: coerceInteiroPositivo(camadasMaximasPalete, 'camadasMaximasPalete'),
      quantidadeVolumes: coerceInteiroPositivo(quantidadeVolumes, 'quantidadeVolumes'),
      custoMedio: coerceDinheiro(custoMedio, 'custoMedio'),
      precoVenda: coerceDinheiro(precoVenda, 'precoVenda'),
    };

    const novoSku = await db.withTransaction(async (client) => {
      let paiId = produtoId || null;
      if (paiId) {
        const pai = await Produto.findById(paiId);
        if (!pai) {
          throw erroValidacao('Produto Pai informado não existe.');
        }
      } else {
        const nomePai = String(descricao).trim();
        // UNIQUE(produtos.nome) (migration 014): em corrida, o segundo INSERT
        // falha com 23505 e caímos no catch externo com 409 claro.
        const pai = (await Produto.findByNome(nomePai, client)) || await Produto.create({
          nome: nomePai,
          categoria: categoria || null,
        }, client);
        paiId = pai.id;
      }

      return Sku.create({
        produto_id: paiId,
        sku,
        descricao,
        volumesPorCamada: campos.volumesPorCamada,
        camadasMaximasPalete: campos.camadasMaximasPalete,
        quantidadeVolumes: campos.quantidadeVolumes,
        fotoUrl: fotoUrl || null,
        cor: cor || null,
        material: material || null,
        codigoBarrasEan: codigoBarrasEan || null,
        custoMedio: campos.custoMedio,
        precoVenda: campos.precoVenda,
      }, client);
    });

    return res.status(201).json(novoSku);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'SKU ou Produto já cadastrado.' });
    }
    return next(err);
  }
}

/**
 * PATCH /api/produtos/:id
 * `:id` é o id do SKU. `categoria` é propagada ao Produto Pai quando o SKU
 * tem um; sem Pai, persiste na coluna legada skus.categoria (nunca é
 * descartada silenciosamente).
 */
async function atualizar(req, res, next) {
  try {
    const body = { ...req.body };

    // `categoria` vive no Produto Pai no novo schema (com fallback na coluna
    // legada do SKU). O restante dos campos segue para o SKU.
    const { categoria, ...camposSku } = body;
    for (const field of ['volumesPorCamada', 'camadasMaximasPalete', 'quantidadeVolumes']) {
      if (camposSku[field] !== undefined) camposSku[field] = coerceInteiroPositivo(camposSku[field], field);
    }
    for (const field of ['custoMedio', 'precoVenda']) {
      if (camposSku[field] !== undefined) camposSku[field] = coerceDinheiro(camposSku[field], field);
    }

    if (categoria !== undefined) {
      const skuAtual = await Sku.findById(req.params.id);
      if (!skuAtual) {
        return res.status(404).json({ erro: 'Produto não encontrado.' });
      }
      if (skuAtual.produto_id) {
        await Produto.update(skuAtual.produto_id, { categoria });
      } else {
        // SKU legado sem Pai: persiste na própria linha do SKU.
        camposSku.categoria = categoria;
      }
    }

    const skuAtualizado = await Sku.update(req.params.id, camposSku);
    if (!skuAtualizado) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    return res.json(skuAtualizado);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, saldosTotais, buscarPorSku, saldo, movimentacoes, criar, atualizar };
