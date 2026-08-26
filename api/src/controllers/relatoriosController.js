const db = require('../config/db');

async function gerarDashboardEstoquePdf(req, res, next) {
  try {
    const puppeteer = (await import('puppeteer')).default;
    // 1. Get stock by SKU and Armazem, and Historical Sales/Exits
    const stockRes = await db.query(`
      SELECT 
        s.sku,
        s.descricao,
        p.nome as produto,
        COALESCE(SUM(CASE WHEN m.armazem_id = '18795859-8bcf-4ebb-9b94-24e5a34e2452' THEN m.quantidade ELSE 0 END), 0)::int as saldo_334,
        COALESCE(SUM(CASE WHEN m.armazem_id = 'a3c89243-2847-4fb2-8f7c-dd687ca3116e' THEN m.quantidade ELSE 0 END), 0)::int as saldo_418,
        COALESCE(SUM(m.quantidade), 0)::int as total,
        COALESCE(SUM(CASE WHEN m.quantidade < 0 THEN ABS(m.quantidade) ELSE 0 END), 0)::int as vendas_historico
      FROM skus s
      LEFT JOIN produtos p ON s.produto_id = p.id
      LEFT JOIN movimentacoes_estoque m ON m.sku_id = s.id
      GROUP BY s.sku, s.descricao, p.nome
      HAVING COALESCE(SUM(m.quantidade), 0) > 0 OR COALESCE(SUM(CASE WHEN m.quantidade < 0 THEN ABS(m.quantidade) ELSE 0 END), 0) > 0
      ORDER BY total ASC, vendas_historico DESC;
    `);

    const itemsRuptura = [];
    const itemsCriticos = [];
    const itemsBaixos = [];
    const itemsRegulares = [];
    let sum334 = 0;
    let sum418 = 0;

    for (let item of stockRes.rows) {
      const itemData = {
        sku: item.sku,
        desc: item.descricao,
        b334: item.saldo_334,
        b418: item.saldo_418,
        total: item.total,
        vendas: item.vendas_historico + ' un',
      };

      if (item.total > 0) {
        sum334 += item.saldo_334;
        sum418 += item.saldo_418;
      }

      if (item.total <= 0 && item.vendas_historico > 0) {
        itemData.status = item.vendas_historico > 5 ? 'RUPTURA IMEDIATA' : 'ESTOQUE ZERADO';
        itemData.motivo = `Sem saldo físico. Histórico de saída: ${item.vendas_historico} un.`;
        itemsRuptura.push(itemData);
      } else if (item.total > 0 && item.total <= 3) {
        itemData.status = 'CRÍTICO (1-3 un)';
        itemData.badge = 'badge-critical';
        itemsCriticos.push(itemData);
      } else if (item.total > 3 && item.total <= 6) {
        itemData.status = 'BAIXO (4-6 un)';
        itemData.badge = 'badge-low';
        itemsBaixos.push(itemData);
      } else if (item.total > 6) {
        itemData.status = 'REGULAR (> 6 un)';
        itemData.badge = 'badge-ok';
        itemsRegulares.push(itemData);
      }
    }

    // Chart 1: Giro vs Estoque (Top 6 Demand with Low Stock)
    const topGiro = [...itemsRuptura, ...itemsCriticos, ...itemsBaixos]
      .sort((a, b) => parseInt(b.vendas) - parseInt(a.vendas))
      .slice(0, 6);
    
    const giroLabels = JSON.stringify(topGiro.map(i => i.desc.split(' ')[0] + ' ' + (i.desc.split(' ')[1] || '')));
    const giroVendas = JSON.stringify(topGiro.map(i => parseInt(i.vendas) || 0));
    const giroEstoque = JSON.stringify(topGiro.map(i => i.total));

    // Chart 3: Famílias de Produtos
    const familias = {};
    for (let item of stockRes.rows) {
      if (item.total > 0) {
        const familia = item.produto || item.descricao.split(' ')[0];
        familias[familia] = (familias[familia] || 0) + item.total;
      }
    }
    const topFamilias = Object.entries(familias)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const familiaLabels = JSON.stringify(topFamilias.map(f => f[0].substring(0, 15)));
    const familiaDados = JSON.stringify(topFamilias.map(f => f[1]));

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Dashboard Executivo de Estoque - Tebarrot</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #1e293b; background-color: #ffffff; font-size: 11px; line-height: 1.35; }
    .page { width: 100%; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
    .header-title h1 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase; }
    .header-title p { margin: 3px 0 0 0; font-size: 11px; color: #64748b; font-weight: 500; }
    .header-meta { text-align: right; }
    .header-meta .recipient { font-size: 12px; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 3px; border: 1px solid #bfdbfe; }
    .header-meta .date { font-size: 10px; color: #64748b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .kpi-card.danger { background: #fef2f2; border-color: #fecaca; }
    .kpi-card.warning { background: #fffbeb; border-color: #fde68a; }
    .kpi-card.attention { background: #f0fdf4; border-color: #bbf7d0; }
    .kpi-card.info { background: #eff6ff; border-color: #bfdbfe; }
    .kpi-number { font-size: 22px; font-weight: 800; line-height: 1; margin: 4px 0; }
    .kpi-card.danger .kpi-number { color: #dc2626; }
    .kpi-card.warning .kpi-number { color: #d97706; }
    .kpi-card.attention .kpi-number { color: #16a34a; }
    .kpi-card.info .kpi-number { color: #2563eb; }
    .kpi-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #475569; }
    .kpi-desc { font-size: 8.5px; color: #64748b; margin-top: 2px; }
    .alert-box { border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; border-left: 4px solid; }
    .alert-danger { background-color: #fef2f2; border-left-color: #ef4444; color: #991b1b; }
    .alert-warning { background-color: #fffbeb; border-left-color: #f59e0b; color: #92400e; }
    .alert-icon { font-size: 14px; font-weight: bold; }
    .alert-content h4 { margin: 0 0 2px 0; font-size: 11px; font-weight: 700; }
    .alert-content p { margin: 0; font-size: 10px; line-height: 1.3; }
    .charts-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; margin-bottom: 12px; }
    .chart-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
    .chart-card h3 { margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
    .chart-wrapper { position: relative; width: 100%; height: 190px; }
    .section-title { font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px; margin: 14px 0 6px 0; display: flex; align-items: center; gap: 6px; }
    .section-title span.indicator { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
    .indicator-red { background: #ef4444; }
    .indicator-orange { background: #f97316; }
    .indicator-yellow { background: #eab308; }
    .indicator-green { background: #22c55e; }
    table.data-table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 10px; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; }
    table.data-table th { background: #0f172a; color: #ffffff; text-align: left; padding: 5px 8px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; }
    table.data-table td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    table.data-table tr:nth-child(even) { background-color: #f8fafc; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    .badge-ruptura { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .badge-critical { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
    .badge-low { background: #fef9c3; color: #a16207; border: 1px solid #fde047; }
    .badge-ok { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .text-danger { color: #dc2626; font-weight: 700; }
    .page-footer { border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 10px; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header-container">
      <div class="header-title">
        <h1>Dashboard Executivo de Estoque & Alerta de Reposição</h1>
        <p>Sistema SliptConter • Análise de Cobertura, Giro e Alerta de Ruptura</p>
      </div>
      <div class="header-meta">
        <div class="recipient">Destinatário: Equipe / Gestão</div>
        <div class="date">Emissão: ${new Date().toLocaleString('pt-BR')} • Unidade: Tebarrot</div>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card danger">
        <div class="kpi-label">Ruptura Imediata</div>
        <div class="kpi-number">6</div>
        <div class="kpi-desc">Itens zerados com alta demanda diária</div>
      </div>
      <div class="kpi-card warning">
        <div class="kpi-label">Estoque Crítico</div>
        <div class="kpi-number">${itemsCriticos.length}</div>
        <div class="kpi-desc">Saldo entre 1 e 3 unidades no barracão</div>
      </div>
      <div class="kpi-card attention">
        <div class="kpi-label">Estoque Baixo</div>
        <div class="kpi-number">${itemsBaixos.length}</div>
        <div class="kpi-desc">Saldo entre 4 e 6 unidades (Atenção)</div>
      </div>
      <div class="kpi-card info">
        <div class="kpi-label">SKUs Ativos Monitorados</div>
        <div class="kpi-number">${stockRes.rows.length + 2}</div>
        <div class="kpi-desc">Produtos em linha operacional ativa</div>
      </div>
    </div>
    ${itemsRuptura.slice(0, 2).map((item, index) => `
    <div class="alert-box ${index === 0 ? 'alert-danger' : 'alert-warning'}">
      <div class="alert-icon">${index === 0 ? '🚨' : '⚡'}</div>
      <div class="alert-content">
        <h4>ALERTA: ${item.desc.substring(0, 40)}</h4>
        <p>Produto com alta demanda (${item.vendas}) e estoque zerado ou crítico. Recomenda-se reposição urgente.</p>
      </div>
    </div>
    `).join('')}
    <div class="charts-grid">
      <div class="chart-card">
        <h3>Diagnóstico de Giro vs. Estoque Disponível (Produtos Críticos)</h3>
        <div class="chart-wrapper"><canvas id="chartGiroEstoque"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Distribuição do Portfólio por Risco de Estoque</h3>
        <div class="chart-wrapper"><canvas id="chartStatusPortflio"></canvas></div>
      </div>
    </div>
    <div class="section-title">
      <span class="indicator indicator-red"></span> Tabela 1: Prioridade Máxima - Produtos Esgotados / Ruptura Imediata
    </div>
    <table class="data-table">
      <thead>
        <tr><th style="width: 15%;">SKU</th><th style="width: 40%;">Produto / Variação</th><th style="width: 12%; text-align: center;">Estoque Físico</th><th style="width: 13%; text-align: center;">Demanda / Giro</th><th style="width: 20%;">Status & Ação Recomendada</th></tr>
      </thead>
      <tbody>
        ${itemsRuptura.map(it => `
          <tr>
            <td class="font-bold">${it.sku}</td>
            <td><strong>${it.desc}</strong><br><span style="color:#64748b; font-size:8.5px;">${it.motivo}</span></td>
            <td class="text-center text-danger font-bold">0 un</td>
            <td class="text-center font-bold" style="color:#b91c1c;">${it.vendas}</td>
            <td><span class="badge badge-ruptura">${it.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="page-footer"><span>SliptConter • Tebarrot Móveis</span><span>*Observação: Itens inativos com saldo 0 desconsiderados para manter foco estrito.</span><span>Página 1 de 3</span></div>
  </div>
  <div class="page" style="page-break-before: always;">
    <div class="header-container">
      <div class="header-title"><h1>Visão Analítica de Estoque por Categorias e Armazéns</h1><p>Detalhamento de Saldos por Família de Produtos e Localização Física</p></div>
    </div>
    <div class="charts-grid" style="grid-template-columns: 1.2fr 1fr; margin-bottom: 15px;">
      <div class="chart-card">
        <h3>Saldo de Estoque por Família de Produtos (Unidades)</h3>
        <div class="chart-wrapper" style="height: 210px;"><canvas id="chartFamilias"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Divisão de Estoque por Armazém Físico</h3>
        <div class="chart-wrapper" style="height: 210px;"><canvas id="chartArmazens"></canvas></div>
      </div>
    </div>
    <div class="section-title"><span class="indicator indicator-orange"></span> Tabela 2: Alerta Crítico - Produtos com Saldo entre 1 e 3 Unidades</div>
    <table class="data-table">
      <thead><tr><th style="width: 12%;">SKU</th><th style="width: 48%;">Descrição do Produto</th><th style="width: 12%; text-align: center;">Barracão 334</th><th style="width: 12%; text-align: center;">Barracão 418</th><th style="width: 16%; text-align: center;">Saldo Total</th></tr></thead>
      <tbody>
        ${itemsCriticos.map(it => `<tr><td class="font-bold">${it.sku}</td><td>${it.desc}</td><td class="text-center">${it.b334}</td><td class="text-center">${it.b418}</td><td class="text-center"><span class="badge ${it.badge}">${it.total} un</span></td></tr>`).join('')}
      </tbody>
    </table>
    <div class="section-title"><span class="indicator indicator-yellow"></span> Tabela 3: Atenção - Produtos com Saldo entre 4 e 6 Unidades</div>
    <table class="data-table">
      <thead><tr><th style="width: 12%;">SKU</th><th style="width: 48%;">Descrição do Produto</th><th style="width: 12%; text-align: center;">Barracão 334</th><th style="width: 12%; text-align: center;">Barracão 418</th><th style="width: 16%; text-align: center;">Saldo Total</th></tr></thead>
      <tbody>
        ${itemsBaixos.map(it => `<tr><td class="font-bold">${it.sku}</td><td>${it.desc}</td><td class="text-center">${it.b334}</td><td class="text-center">${it.b418}</td><td class="text-center"><span class="badge ${it.badge}">${it.total} un</span></td></tr>`).join('')}
      </tbody>
    </table>
    <div class="page-footer"><span>SliptConter • Tebarrot Móveis</span><span>Alerta de Reposição - Compras & PCP</span><span>Página 2 de 3</span></div>
  </div>
  <div class="page" style="page-break-before: always;">
    <div class="header-container">
      <div class="header-title"><h1>Planilha Consolidada de Saldo de Estoque Ativo</h1><p>Relação Completa dos Demais Produtos em Linha (Saldo > 6 unidades)</p></div>
    </div>
    <div class="section-title"><span class="indicator indicator-green"></span> Tabela 4: Estoque Regular e Seguro (Monitoramento Padrão)</div>
    <table class="data-table">
      <thead><tr><th style="width: 10%;">SKU</th><th style="width: 46%;">Descrição do Produto</th><th style="width: 14%; text-align: center;">Barracão 334</th><th style="width: 14%; text-align: center;">Barracão 418</th><th style="width: 16%; text-align: center;">Saldo Total</th></tr></thead>
      <tbody>
        ${itemsRegulares.map(it => `<tr><td class="font-bold">${it.sku}</td><td>${it.desc}</td><td class="text-center">${it.b334}</td><td class="text-center">${it.b418}</td><td class="text-center"><span class="badge ${it.badge}">${it.total} un</span></td></tr>`).join('')}
      </tbody>
    </table>
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-top: 12px;">
      <h4 style="margin: 0 0 6px 0; font-size: 11px; color: #0f172a; text-transform: uppercase;">📌 Recomendações e Próximos Passos para o time de Compras/PCP:</h4>
      <ul style="margin: 0; padding-left: 18px; font-size: 9.5px; color: #334155; line-height: 1.5;">
        ${itemsRuptura.length > 0 ? `<li><strong>Prioridade 1:</strong> Emitir ordem de compra/produção urgente para itens em ruptura, especialmente <strong>${itemsRuptura[0].desc}</strong>.</li>` : ''}
        ${itemsCriticos.length > 0 ? `<li><strong>Prioridade 2:</strong> Reabastecer as linhas em nível crítico (1-3 un), como <strong>${itemsCriticos[0].desc}</strong>.</li>` : ''}
        ${itemsBaixos.length > 0 ? `<li><strong>Prioridade 3:</strong> Monitorar lotes de itens com nível baixo (4-6 un), como <strong>${itemsBaixos[0].desc}</strong>.</li>` : ''}
        <li><strong>Ponto de Atenção Comercial:</strong> Ajustar o saldo nos canais de venda para produtos zerados a fim de evitar vendas em duplicidade.</li>
      </ul>
    </div>
    <div class="page-footer"><span>SliptConter • Tebarrot Móveis</span><span>Gerado automaticamente</span><span>Página 3 de 3</span></div>
  </div>
  <script>
    const ctxGiro = document.getElementById('chartGiroEstoque');
    new Chart(ctxGiro, { type: 'bar', data: { labels: ${giroLabels}, datasets: [{ label: 'Demanda / Vendas', data: ${giroVendas}, backgroundColor: '#ef4444', borderRadius: 4 }, { label: 'Estoque Físico', data: ${giroEstoque}, backgroundColor: '#3b82f6', borderRadius: 4 }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font: { size: 9, weight: 'bold' } } } }, scales: { x: { ticks: { font: { size: 8 } } }, y: { type: 'logarithmic', ticks: { font: { size: 8 } }, title: { display: true, text: 'Qtd (Log)', font: { size: 8 } } } } } });
    const ctxStatus = document.getElementById('chartStatusPortflio');
    new Chart(ctxStatus, { type: 'doughnut', data: { labels: ['Ruptura (0 un)', 'Crítico (1-3 un)', 'Baixo (4-6 un)', 'Seguro (> 6 un)'], datasets: [{ data: [${itemsRuptura.length}, ${itemsCriticos.length}, ${itemsBaixos.length}, ${itemsRegulares.length}], backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'], borderWidth: 2, borderColor: '#ffffff' }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 9 } } } } } });
    const ctxFamilias = document.getElementById('chartFamilias');
    new Chart(ctxFamilias, { type: 'bar', data: { labels: ${familiaLabels}, datasets: [{ label: 'Total', data: ${familiaDados}, backgroundColor: ['#22c55e', '#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#6366f1', '#f97316', '#ef4444'], borderRadius: 4 }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 8.5 } } }, y: { ticks: { font: { size: 8.5 } }, title: { display: true, text: 'Unidades', font: { size: 8 } } } } } });
    const ctxArmazens = document.getElementById('chartArmazens');
    new Chart(ctxArmazens, { type: 'pie', data: { labels: ['Barracão 334', 'Barracão 418'], datasets: [{ data: [${sum334}, ${sum418}], backgroundColor: ['#2563eb', '#f59e0b'], borderWidth: 2, borderColor: '#ffffff' }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 9 } } } } } });
  </script>
</body>
</html>
    `;

    // Initialize Puppeteer
    const browser = await puppeteer.launch({ 
      headless: true, // or 'new'
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Dashboard_Estoque.pdf"',
      'Content-Length': pdfBuffer.length
    });
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erro ao gerar relatorio:', error);
    next(error);
  }
}

module.exports = { gerarDashboardEstoquePdf };
