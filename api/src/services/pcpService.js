/**
 * Service: pcpService
 * Indicadores e inteligência de PCP (Planejamento e Controle de Produção e Estoque):
 *  - Curva ABC de SKUs (Volume e Valor)
 *  - Giro e Cobertura de Estoque (Dias de Estoque)
 *  - Sugestão de Produção / Ponto de Reposição
 *  - Acuracidade de Inventário Histórica (IRA %)
 *  - Gestão de Perdas e Avarias (Scrap)
 */
const db = require('../config/db');

async function obterIndicadoresPCP({ diasAnalise = 30 } = {}) {
  // 1. Demanda de saídas por SKU no período (média diária)
  const vendasRes = await db.query(
    `SELECT
       s.id AS sku_id,
       s.sku,
       s.descricao AS sku_descricao,
       COALESCE(NULLIF(s.categoria, ''), p.categoria, 'Sem categoria') AS categoria,
       COALESCE(s.custo_medio, 0)::numeric AS custo_medio,
       COALESCE(s.preco_venda, 0)::numeric AS preco_venda,
       COALESCE(SUM(ABS(m.quantidade)), 0)::int AS total_saidas,
       ROUND(COALESCE(SUM(ABS(m.quantidade)), 0)::numeric / $1, 2) AS media_diaria_saidas,
       COALESCE(SUM(ABS(m.quantidade) * COALESCE(s.preco_venda, s.custo_medio, 0)), 0)::numeric AS valor_faturado
     FROM skus s
     LEFT JOIN produtos p ON p.id = s.produto_id
     LEFT JOIN movimentacoes_estoque m
       ON m.sku_id = s.id
       AND m.tipo = 'saida'
       AND m.created_at >= CURRENT_DATE - ($1 || ' days')::interval
     WHERE s.ativo = TRUE
     GROUP BY s.id, s.sku, s.descricao, s.categoria, p.categoria, s.custo_medio, s.preco_venda
     ORDER BY valor_faturado DESC, total_saidas DESC`,
    [diasAnalise]
  );

  // 2. Saldos atuais por SKU
  const saldosRes = await db.query(
    `SELECT sku_id, COALESCE(SUM(quantidade), 0)::int AS saldo_atual
     FROM movimentacoes_estoque
     GROUP BY sku_id`
  );
  const mapSaldo = new Map(saldosRes.rows.map((r) => [r.sku_id, r.saldo_atual]));

  // 3. Cálculo da Curva ABC e Cobertura de Estoque
  const totalFaturadoGeral = vendasRes.rows.reduce((acc, r) => acc + parseFloat(r.valor_faturado || 0), 0);
  let acumulado = 0;

  const skusAnalise = vendasRes.rows.map((row) => {
    const valorFaturado = parseFloat(row.valor_faturado || 0);
    acumulado += valorFaturado;
    const pctAcumulado = totalFaturadoGeral > 0 ? (acumulado / totalFaturadoGeral) * 100 : 100;

    let curvaABC = 'C';
    if (pctAcumulado <= 80) curvaABC = 'A';
    else if (pctAcumulado <= 95) curvaABC = 'B';

    const saldoAtual = mapSaldo.get(row.sku_id) || 0;
    const mediaDiaria = parseFloat(row.media_diaria_saidas || 0);

    let diasCobertura = null;
    let statusCobertura = 'sem_giro';

    if (mediaDiaria > 0) {
      diasCobertura = Math.round(saldoAtual / mediaDiaria);
      if (saldoAtual <= 0 || diasCobertura <= 7) {
        statusCobertura = 'critico';
      } else if (diasCobertura <= 15) {
        statusCobertura = 'atencao';
      } else if (diasCobertura <= 45) {
        statusCobertura = 'ideal';
      } else {
        statusCobertura = 'excesso';
      }
    } else if (saldoAtual <= 0) {
      statusCobertura = 'zerado';
    } else {
      statusCobertura = 'sem_giro';
    }

    // Sugestão de produção (meta: 30 dias de cobertura + estoque de segurança de 7 dias)
    const metaEstoque = Math.ceil(mediaDiaria * 30);
    const sugestaoProducao = Math.max(0, metaEstoque - saldoAtual);

    return {
      skuId: row.sku_id,
      sku: row.sku,
      descricao: row.sku_descricao,
      categoria: row.categoria,
      custoMedio: parseFloat(row.custo_medio),
      precoVenda: parseFloat(row.preco_venda),
      totalSaidas: row.total_saidas,
      mediaDiariaSaidas: mediaDiaria,
      valorFaturado,
      curvaABC,
      saldoAtual,
      diasCobertura,
      statusCobertura,
      metaEstoque30Dias: metaEstoque,
      sugestaoProducao,
    };
  });

  // 4. Agrupamentos de Alertas e Totais
  const itensCriticos = skusAnalise.filter((i) => i.statusCobertura === 'critico' && i.mediaDiariaSaidas > 0);
  const itensEmExcesso = skusAnalise.filter((i) => i.statusCobertura === 'excesso');
  const sugestoesProducao = skusAnalise
    .filter((i) => i.sugestaoProducao > 0 && (i.curvaABC === 'A' || i.curvaABC === 'B'))
    .sort((a, b) => b.sugestaoProducao - a.sugestaoProducao);

  // 5. Histórico de Acuracidade de Inventário (IRA %)
  const invRes = await db.query(
    `SELECT
       COUNT(*)::int AS total_inventarios,
       COALESCE(AVG(acuracidade_pct), 0)::numeric(5,2) AS media_acuracidade_pct,
       COALESCE(SUM(itens_contados), 0)::int AS total_itens_contados,
       COALESCE(SUM(itens_acurados), 0)::int AS total_itens_acurados
     FROM ordens_inventario
     WHERE status = 'concluido'`
  );

  // 6. Relatório de Perdas e Ajustes por Motivo
  const perdasRes = await db.query(
    `SELECT
       COALESCE(motivo_ajuste, 'ajuste_geral') AS motivo,
       COUNT(*)::int AS ocorrencias,
       COALESCE(SUM(ABS(quantidade)), 0)::int AS total_pecas,
       COALESCE(SUM(ABS(quantidade) * COALESCE(s.custo_medio, 0)), 0)::numeric(10,2) AS impacto_financeiro
     FROM movimentacoes_estoque m
     JOIN skus s ON s.id = m.sku_id
     WHERE m.tipo = 'ajuste' AND m.quantidade < 0
     GROUP BY COALESCE(motivo_ajuste, 'ajuste_geral')
     ORDER BY impacto_financeiro DESC`
  );

  return {
    diasAnalise,
    totalSkus: skusAnalise.length,
    distribuicaoCurvaABC: {
      A: skusAnalise.filter((i) => i.curvaABC === 'A').length,
      B: skusAnalise.filter((i) => i.curvaABC === 'B').length,
      C: skusAnalise.filter((i) => i.curvaABC === 'C').length,
    },
    resumoCobertura: {
      criticos: itensCriticos.length,
      atencao: skusAnalise.filter((i) => i.statusCobertura === 'atencao').length,
      ideal: skusAnalise.filter((i) => i.statusCobertura === 'ideal').length,
      excesso: itensEmExcesso.length,
      semGiro: skusAnalise.filter((i) => i.statusCobertura === 'sem_giro' || i.statusCobertura === 'zerado').length,
    },
    acuracidadeInventario: invRes.rows[0],
    perdasPorMotivo: perdasRes.rows,
    itensCriticos: itensCriticos.slice(0, 15),
    sugestoesProducao: sugestoesProducao.slice(0, 20),
    skus: skusAnalise,
  };
}

module.exports = {
  obterIndicadoresPCP,
};
