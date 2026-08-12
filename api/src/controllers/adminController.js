/**
 * Controller administrativo do Painel Web (SliptConter Web Admin).
 *
 * Expõe métricas consolidadas e relatórios para o painel de Administradores
 * e Gestores, evitando múltiplas queries no frontend. Todas as rotas são
 * protegidas por autenticação (JWT) e RBAC (papel admin/gestor) — ver
 * adminRoutes.js.
 *
 * O saldo de estoque é SEMPRE derivado do ledger imutável
 * (movimentacoes_estoque) via SUM(quantidade), nunca de um campo gravado.
 */
const db = require('../config/db');
const { registrarMovimentacao } = require('../services/ledgerService');

/**
 * GET /api/admin/dashboard-metrics
 * Retorna numa única chamada:
 *  - totalSkusAtivos
 *  - totalPecasEstoque (SUM global do ledger)
 *  - valorTotalEstoque (custo médio x saldo)
 *  - conferenciasHoje
 *  - totalArmazens
 *  - alertasEstoqueBaixo (saldo <= limite)
 *  - pendenciasSheets (itens na fila de sincronização)
 *  - serieTemporal (entradas vs saídas vs ajustes por dia)
 *  - distribuicaoPorArmazem / distribuicaoPorCategoria
 */
async function dashboardMetrics(req, res, next) {
  try {
    const limiteAlerta = parseInt(req.query.limiteAlerta, 10);
    const alertThreshold = Number.isFinite(limiteAlerta) ? limiteAlerta : 0;

    // 1. SKUs ativos, peças totais e valor total do estoque.
    const estoqueRes = await db.query(
      `SELECT
         COUNT(DISTINCT s.id)                                    AS "totalSkusAtivos",
         COALESCE(SUM(m.quantidade), 0)::int                     AS "totalPecasEstoque",
         COALESCE(SUM(m.quantidade * COALESCE(s.custo_medio, 0)), 0)::numeric
                                                              AS "valorTotalEstoque"
       FROM skus s
       LEFT JOIN movimentacoes_estoque m ON m.sku_id = s.id
       WHERE s.ativo = TRUE`,
      []
    );

    // 2. Conferências realizadas hoje (galpão).
    const conferenciasHojeRes = await db.query(
      `SELECT COUNT(*)::int AS "conferenciasHoje"
       FROM conferencias
       WHERE DATE(created_at) = CURRENT_DATE`,
      []
    );

    // 3. Total de armazéns ativos.
    const armazensRes = await db.query(
      `SELECT COUNT(*)::int AS "totalArmazens" FROM armazens WHERE ativo = TRUE`,
      []
    );

    // 4. Alertas de estoque baixo/zerado.
    const alertasRes = await db.query(
      `SELECT s.id, s.sku, s.descricao,
              COALESCE(SUM(m.quantidade), 0)::int AS saldo
       FROM skus s
       LEFT JOIN movimentacoes_estoque m ON m.sku_id = s.id
       WHERE s.ativo = TRUE
       GROUP BY s.id
       HAVING COALESCE(SUM(m.quantidade), 0) <= $1
       ORDER BY saldo ASC
       LIMIT 50`,
      [alertThreshold]
    );

    // 5. Pendências da fila de sincronização com Google Sheets.
    const pendenciasRes = await db.query(
      `SELECT COUNT(*)::int AS "pendenciasSheets"
       FROM sheets_sync_queue
       WHERE status IN ('pendente', 'erro')`,
      []
    );

    // 6. Série temporal (últimos 30 dias): entradas/saídas/ajustes.
    const serieRes = await db.query(
      `SELECT DATE(created_at) AS data,
              SUM(CASE WHEN tipo = 'entrada' THEN quantidade ELSE 0 END)::int AS entradas,
              SUM(CASE WHEN tipo = 'saida'   THEN quantidade ELSE 0 END)::int AS saidas,
              SUM(CASE WHEN tipo = 'ajuste'  THEN quantidade ELSE 0 END)::int AS ajustes
       FROM movimentacoes_estoque
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY data ASC`,
      []
    );

    // 7. Distribuição por armazém (saldo total por armazém).
    const porArmazemRes = await db.query(
      `SELECT a.id, a.nome,
              COALESCE(SUM(m.quantidade), 0)::int AS saldo
       FROM armazens a
       LEFT JOIN movimentacoes_estoque m ON m.armazem_id = a.id
       WHERE a.ativo = TRUE
       GROUP BY a.id, a.nome
       ORDER BY saldo DESC`,
      []
    );

    // 8. Distribuição por categoria (saldo total por categoria do SKU/Pai).
    const porCategoriaRes = await db.query(
      `SELECT COALESCE(NULLIF(s.categoria, ''), p.categoria, 'Sem categoria') AS categoria,
              COALESCE(SUM(m.quantidade), 0)::int AS saldo
       FROM skus s
       LEFT JOIN produtos p ON p.id = s.produto_id
       LEFT JOIN movimentacoes_estoque m ON m.sku_id = s.id
       WHERE s.ativo = TRUE
       GROUP BY categoria
       ORDER BY saldo DESC
       LIMIT 15`,
      []
    );

    const base = estoqueRes.rows[0];
    return res.json({
      totalSkusAtivos: parseInt(base.totalSkusAtivos, 10),
      totalPecasEstoque: parseInt(base.totalPecasEstoque, 10),
      valorTotalEstoque: parseFloat(base.valorTotalEstoque || 0),
      conferenciasHoje: conferenciasHojeRes.rows[0].conferenciasHoje,
      totalArmazens: armazensRes.rows[0].totalArmazens,
      pendenciasSheets: pendenciasRes.rows[0].pendenciasSheets,
      limiteAlerta: alertThreshold,
      alertasEstoqueBaixo: alertasRes.rows,
      serieTemporal: serieRes.rows,
      distribuicaoPorArmazem: porArmazemRes.rows,
      distribuicaoPorCategoria: porCategoriaRes.rows,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/estoque-consolidado
 * Matriz completa de estoque enriquecida (SKU + Descrição + Categoria +
 * Saldo por Armazém + Custo Médio + Status). Suporta filtros de busca,
 * armazém, categoria e "apenas estoque baixo", além de ordenação.
 */
async function estoqueConsolidado(req, res, next) {
  try {
    const {
      busca,
      armazemId,
      categoria,
      apenasBaixo,
      ordenarPor = 'descricao',
      ordem = 'asc',
      limiteAlerta,
    } = req.query;

    const params = [];
    const filtros = ['s.ativo = TRUE'];

    if (busca) {
      params.push(`%${busca}%`);
      filtros.push(
        `(s.sku ILIKE $${params.length} OR s.descricao ILIKE $${params.length} OR p.nome ILIKE $${params.length} OR s.codigo_barras_ean ILIKE $${params.length})`
      );
    }
    if (armazemId) {
      params.push(armazemId);
      filtros.push(`EXISTS (SELECT 1 FROM movimentacoes_estoque m WHERE m.sku_id = s.id AND m.armazem_id = $${params.length})`);
    }
    if (categoria) {
      params.push(categoria);
      filtros.push(`(s.categoria = $${params.length} OR p.categoria = $${params.length})`);
    }

    const colunasOrdenacao = {
      sku: 's.sku',
      descricao: 's.descricao',
      categoria: 'categoria',
      saldo: 'saldo',
      custo: 's.custo_medio',
      preco: 's.preco_venda',
    };
    const colunaOrdem = colunasOrdenacao[ordenarPor] || 's.descricao';
    const direcao = ordem === 'desc' ? 'DESC' : 'ASC';

    const saldoSub =
      `(SELECT COALESCE(SUM(m.quantidade), 0)::int FROM movimentacoes_estoque m WHERE m.sku_id = s.id)`;

    let sql = `
      SELECT
        s.id, s.sku, s.descricao,
        COALESCE(NULLIF(s.categoria, ''), p.categoria) AS categoria,
        s.volumes_por_camada, s.camadas_maximas_palete,
        s.codigo_barras_ean, s.custo_medio, s.preco_venda,
        s.ativo,
        ${saldoSub} AS saldo,
        COALESCE(${saldoSub}, 0) * COALESCE(s.custo_medio, 0) AS valor_estoque,
        p.nome AS produto_nome
      FROM skus s
      LEFT JOIN produtos p ON p.id = s.produto_id
      WHERE ${filtros.join(' AND ')}
    `;

    if (apenasBaixo === 'true' || apenasBaixo === '1') {
      const threshold = Number.isFinite(parseInt(limiteAlerta, 10)) ? parseInt(limiteAlerta, 10) : 0;
      sql += ` AND ${saldoSub} <= ${threshold}`;
    }

    sql += ` ORDER BY ${colunaOrdem} ${direcao}`;

    const { rows } = await db.query(sql, params);

    // Status de estoque derivado do saldo.
    const threshold = Number.isFinite(parseInt(limiteAlerta, 10)) ? parseInt(limiteAlerta, 10) : 0;
    const dados = rows.map((r) => {
      const saldo = parseInt(r.saldo, 10);
      let status = 'normal';
      if (saldo <= 0) status = 'zerado';
      else if (saldo <= threshold) status = 'baixo';
      return {
        ...r,
        saldo,
        status,
      };
    });

    return res.json(dados);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/relatorios/exportar
 * Gera o payload estruturado de estoque e movimentações para o frontend
 * montar o CSV/XLSX. Aceita ?tipo=estoque|movimentacoes e os mesmos filtros
 * de estoque-consolidado (para o relatório de estoque).
 */
async function exportarRelatorio(req, res, next) {
  try {
    const { tipo = 'estoque' } = req.query;

    if (tipo === 'movimentacoes') {
      const { skuId, armazemId, limit, offset } = req.query;
      const Movimentacao = require('../models/MovimentacaoEstoque');
      const linhas = await Movimentacao.list({
        skuId,
        armazemId,
        limit: limit ? parseInt(limit, 10) : 1000,
        offset: offset ? parseInt(offset, 10) : 0,
      });
      return res.json({ tipo, linhas });
    }

    // Relatório de estoque consolidado (reaproveita a query anterior).
    const resultado = await estoqueConsolidado(
      { query: req.query, usuario: req.usuario },
      { json: (d) => d }
    );
    return res.json({ tipo: 'estoque', linhas: resultado });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/admin/estoque/ajuste
 * Registra um Ajuste Manual de Estoque no ledger imutável, justificando o
 * motivo (quebra, inventário geral, perda, devolução). O delta é calculado
 * em relação ao saldo atual do SKU no armazém informado.
 *
 * body: { skuId, armazemId, quantidadeAjuste (assinada), observacao, motivo }
 */
async function ajusteManual(req, res, next) {
  try {
    const { skuId, armazemId, quantidadeAjuste, observacao, motivo } = req.body;

    if (!skuId || !armazemId) {
      return res.status(400).json({ erro: 'skuId e armazemId são obrigatórios.' });
    }
    const qtd = parseInt(quantidadeAjuste, 10);
    if (!Number.isInteger(qtd) || qtd === 0) {
      return res.status(400).json({ erro: 'quantidadeAjuste deve ser um inteiro diferente de zero.' });
    }

    const observacaoFinal = `Ajuste manual (${motivo || 'não informado'}): ${observacao || ''}`.trim();

    const movimentacao = await db.withTransaction(async (client) => {
      // Usa o ledgerService dentro da transação para reaproveitar regras e
      // enfileirar a sincronização com o Sheets.
      const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
      const SheetsSyncQueue = require('../models/SheetsSyncQueue');
      const ledgerService = require('../services/ledgerService');

      const mv = await ledgerService.registrarMovimentacao(
        {
          skuId,
          armazemId,
          tipo: 'ajuste',
          quantidade: qtd,
          idOperador: req.usuario.id,
          observacao: observacaoFinal,
        },
        client
      );
      return mv;
    });

    return res.status(201).json({
      id: movimentacao.id,
      skuId,
      armazemId,
      quantidade: qtd,
      mensagem: 'Ajuste manual registrado com sucesso.',
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/usuarios
 * Lista de usuários do sistema para o módulo de Gestão de Operadores.
 */
async function listarUsuarios(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, nome, username, papel, ativo, created_at
       FROM usuarios
       ORDER BY ativo DESC, nome ASC`
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/admin/usuarios
 * Cadastro de operador/gestor (master data de usuários).
 * body: { nome, username, senha, papel? }
 */
async function criarUsuario(req, res, next) {
  try {
    const { nome, username, senha, papel } = req.body;
    if (!nome || !username || !senha) {
      return res.status(400).json({ erro: 'nome, username e senha são obrigatórios.' });
    }
    const Usuario = require('../models/Usuario');
    const usuario = await Usuario.create({
      nome,
      username,
      senha,
      papel: papel || 'operador',
    });
    return res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      username: usuario.username,
      papel: usuario.papel,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Username já cadastrado.' });
    }
    return next(err);
  }
}

/**
 * PATCH /api/admin/usuarios/:id
 * Atualização de operador (nome, papel, ativo e/ou redefinição de senha).
 */
async function atualizarUsuario(req, res, next) {
  try {
    const { id } = req.params;
    const { nome, papel, ativo, senha } = req.body;
    const campos = [];
    const params = [];

    const set = (valor, sql) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params.push(valor);
        campos.push(`${sql} = $${params.length}`);
      }
    };
    set(nome, 'nome');
    set(papel, 'papel');
    set(ativo, 'ativo');
    set(senha, 'senha');

    if (campos.length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
    }
    params.push(id);
    const { rows } = await db.query(
      `UPDATE usuarios SET ${campos.join(', ')}, updated_at = now()
       WHERE id = $${params.length} RETURNING id, nome, username, papel, ativo`,
      params
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Username já cadastrado.' });
    }
    return next(err);
  }
}

module.exports = {
  dashboardMetrics,
  estoqueConsolidado,
  exportarRelatorio,
  ajusteManual,
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
};
