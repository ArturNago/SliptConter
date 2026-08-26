const Armazem = require('../models/Armazem');
const Sku = require('../models/Sku');
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const db = require('../config/db');
const ledgerService = require('../services/ledgerService');

async function listar(req, res, next) {
  try {
    const ativo = req.query.ativo === undefined ? true : req.query.ativo !== 'false';
    return res.json(await Armazem.list({ ativo }));
  } catch (err) {
    return next(err);
  }
}

async function criar(req, res, next) {
  try {
    const nome = String(req.body.nome || '').trim();
    const codigo = String(req.body.codigo || '').trim().toUpperCase() || null;
    if (!nome) return res.status(400).json({ erro: 'Nome do armazém é obrigatório.' });

    const armazem = await Armazem.create({ nome, codigo });
    return res.status(201).json(armazem);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Código de armazém já cadastrado.' });
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const payload = {
      nome: req.body.nome === undefined ? undefined : String(req.body.nome).trim(),
      codigo: req.body.codigo === undefined ? undefined : String(req.body.codigo).trim().toUpperCase(),
      ativo: req.body.ativo === undefined
        ? undefined
        : req.body.ativo === true || req.body.ativo === 'true',
    };
    if (payload.nome === '') return res.status(400).json({ erro: 'Nome do armazém não pode ficar vazio.' });

    const armazem = await Armazem.update(req.params.id, payload);
    if (!armazem) return res.status(404).json({ erro: 'Armazém não encontrado.' });
    return res.json(armazem);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Código de armazém já cadastrado.' });
    return next(err);
  }
}

async function estoque(req, res, next) {
  try {
    const armazem = await Armazem.findById(req.params.id);
    if (!armazem) return res.status(404).json({ erro: 'Armazém não encontrado.' });
    return res.json(await Armazem.estoque(req.params.id));
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/armazens/transferencia
 * Transferência atômica entre 2 armazéns com trava anti-negativação.
 * body: { skuId, armazemOrigemId, armazemDestinoId, quantidade, observacao }
 */
async function transferir(req, res, next) {
  try {
    const { skuId, armazemOrigemId, armazemDestinoId, quantidade, observacao } = req.body;

    if (!skuId || !armazemOrigemId || !armazemDestinoId || !quantidade) {
      return res.status(400).json({ erro: 'skuId, armazemOrigemId, armazemDestinoId e quantidade são obrigatórios.' });
    }

    const qtd = parseInt(quantidade, 10);
    if (!Number.isInteger(qtd) || qtd <= 0) {
      return res.status(400).json({ erro: 'Quantidade da transferência deve ser um número inteiro positivo.' });
    }

    if (armazemOrigemId === armazemDestinoId) {
      return res.status(400).json({ erro: 'O armazém de origem deve ser diferente do armazém de destino.' });
    }

    const [sku, origem, destino] = await Promise.all([
      Sku.findById(skuId),
      Armazem.findById(armazemOrigemId),
      Armazem.findById(armazemDestinoId),
    ]);

    if (!sku) return res.status(404).json({ erro: 'SKU não encontrado.' });
    if (!origem || !origem.ativo) return res.status(404).json({ erro: 'Armazém de origem inválido ou inativo.' });
    if (!destino || !destino.ativo) return res.status(404).json({ erro: 'Armazém de destino inválido ou inativo.' });

    // Trava Anti-Negativação: Verifica saldo do armazém de origem
    const saldoOrigemAtual = await MovimentacaoEstoque.saldoPorSku(sku.id, origem.id);
    if (saldoOrigemAtual < qtd) {
      return res.status(400).json({
        erro: `Saldo insuficiente no armazém de origem "${origem.nome}". Saldo atual: ${saldoOrigemAtual} un, solicitado: ${qtd} un.`,
        saldoOrigemAtual,
        solicitado: qtd,
      });
    }

    // Executa a dupla entrada atômica
    const idOperador = req.usuario?.sub || req.usuario?.id;

    const resultado = await db.withTransaction(async (client) => {
      // 1. Debita da Origem (-qtd)
      const movSaida = await ledgerService.registrarMovimentacao({
        skuId: sku.id,
        armazemId: origem.id,
        tipo: 'saida',
        quantidade: -qtd,
        idOperador,
        observacao: observacao ? `Transferência para ${destino.nome}: ${observacao}` : `Transferência para ${destino.nome}`,
      }, client);

      // 2. Credita no Destino (+qtd)
      const movEntrada = await ledgerService.registrarMovimentacao({
        skuId: sku.id,
        armazemId: destino.id,
        tipo: 'entrada',
        quantidade: qtd,
        idOperador,
        observacao: observacao ? `Transferência recebida de ${origem.nome}: ${observacao}` : `Transferência recebida de ${origem.nome}`,
      }, client);

      return { movSaida, movEntrada };
    });

    const [novoSaldoOrigem, novoSaldoDestino] = await Promise.all([
      MovimentacaoEstoque.saldoPorSku(sku.id, origem.id),
      MovimentacaoEstoque.saldoPorSku(sku.id, destino.id),
    ]);

    return res.status(200).json({
      sucesso: true,
      mensagem: `Transferência de ${qtd} un de ${sku.sku} concluída com sucesso!`,
      origem: { id: origem.id, nome: origem.nome, novoSaldo: novoSaldoOrigem },
      destino: { id: destino.id, nome: destino.nome, novoSaldo: novoSaldoDestino },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/armazens/matriz-comparativa
 * Retorna todos os SKUs com o saldo de cada um dos 4 armazéns lado a lado.
 */
async function matrizComparativa(req, res, next) {
  try {
    const { busca, categoria } = req.query;
    const params = [];
    let filtros = '';

    if (busca) {
      params.push(`%${String(busca).trim()}%`);
      filtros += ` AND (s.sku ILIKE $${params.length} OR s.descricao ILIKE $${params.length} OR p.nome ILIKE $${params.length})`;
    }
    if (categoria) {
      params.push(`%${String(categoria).trim()}%`);
      filtros += ` AND (p.categoria ILIKE $${params.length} OR s.categoria ILIKE $${params.length})`;
    }

    const { rows: armazensAtivos } = await db.query('SELECT id, nome, codigo FROM armazens WHERE ativo = TRUE ORDER BY codigo ASC, nome ASC');

    const sql = `
      SELECT 
        s.id AS sku_id,
        s.sku,
        s.descricao,
        COALESCE(p.categoria, s.categoria) AS categoria,
        s.volumes_por_camada,
        s.camadas_maximas_palete,
        jsonb_object_agg(a.id, COALESCE(saldo_armazem.saldo, 0)) AS saldos_por_armazem_id,
        COALESCE(SUM(saldo_armazem.saldo), 0)::int AS saldo_total
      FROM skus s
      LEFT JOIN produtos p ON p.id = s.produto_id
      CROSS JOIN armazens a
      LEFT JOIN (
        SELECT sku_id, armazem_id, COALESCE(SUM(quantidade), 0)::int AS saldo
        FROM movimentacoes_estoque
        GROUP BY sku_id, armazem_id
      ) saldo_armazem ON saldo_armazem.sku_id = s.id AND saldo_armazem.armazem_id = a.id
      WHERE s.ativo = TRUE AND a.ativo = TRUE ${filtros}
      GROUP BY s.id, s.sku, s.descricao, p.categoria, s.categoria, s.volumes_por_camada, s.camadas_maximas_palete
      ORDER BY s.sku ASC;
    `;

    const { rows: itens } = await db.query(sql, params);

    return res.json({
      armazens: armazensAtivos,
      itens,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, criar, atualizar, estoque, transferir, matrizComparativa };
