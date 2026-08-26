const PDFDocument = require('pdfkit');
const db = require('../config/db');
const { format } = require('date-fns');

async function gerarDashboardEstoquePdf(req, res, next) {
  try {
    const stockRes = await db.query(
      SELECT p.id, p.sku, p.descricao, p.familia, 
             COALESCE(SUM(s.quantidade), 0) as total,
             COALESCE(SUM(CASE WHEN a.codigo = '334' THEN s.quantidade ELSE 0 END), 0) as b334,
             COALESCE(SUM(CASE WHEN a.codigo = '418' THEN s.quantidade ELSE 0 END), 0) as b418
      FROM produtos p
      LEFT JOIN saldos_estoque s ON p.id = s.produto_id
      LEFT JOIN armazens a ON s.armazem_id = a.id
      WHERE p.ativo = TRUE
      GROUP BY p.id, p.sku, p.descricao, p.familia
      ORDER BY total ASC, p.sku ASC
    );
    const produtos = stockRes.rows;

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Dashboard_Estoque.pdf"',
    });
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Relatório de Estoque - SliptConter', { align: 'center' });
    doc.fontSize(12).text(Data:  + format(new Date(), 'dd/MM/yyyy HH:mm'), { align: 'center' });
    doc.moveDown(2);

    // Categories
    const ruptura = produtos.filter(p => Number(p.total) === 0);
    const critico = produtos.filter(p => Number(p.total) >= 1 && Number(p.total) <= 3);
    const baixo = produtos.filter(p => Number(p.total) >= 4 && Number(p.total) <= 6);
    const regular = produtos.filter(p => Number(p.total) > 6);

    doc.fontSize(14).text(Resumo do Estoque, { underline: true });
    doc.fontSize(12)
       .text(- Ruptura (0 un):  + ruptura.length)
       .text(- Crítico (1-3 un):  + critico.length)
       .text(- Baixo (4-6 un):  + baixo.length)
       .text(- Seguro (>6 un):  + regular.length);
    doc.moveDown(2);

    const drawTable = (title, items) => {
      if(items.length === 0) return;
      doc.addPage();
      doc.fontSize(14).text(title, { underline: true });
      doc.moveDown(1);
      
      let y = doc.y;
      doc.fontSize(10);
      doc.text('SKU', 30, y, { width: 80 });
      doc.text('Descrição', 110, y, { width: 250 });
      doc.text('B334', 360, y, { width: 50 });
      doc.text('B418', 410, y, { width: 50 });
      doc.text('Total', 460, y, { width: 50 });
      
      doc.moveTo(30, y + 15).lineTo(550, y + 15).stroke();
      y += 20;

      items.forEach(it => {
        if (y > 750) {
          doc.addPage();
          y = 30;
        }
        doc.fontSize(9);
        doc.text(it.sku, 30, y, { width: 80 });
        doc.text(it.descricao.substring(0, 50), 110, y, { width: 250 });
        doc.text(it.b334.toString(), 360, y, { width: 50 });
        doc.text(it.b418.toString(), 410, y, { width: 50 });
        doc.text(it.total.toString(), 460, y, { width: 50 });
        y += 15;
      });
    };

    drawTable('Produtos em Ruptura (0 un)', ruptura);
    drawTable('Estoque Crítico (1-3 un)', critico);
    drawTable('Estoque Baixo (4-6 un)', baixo);
    drawTable('Estoque Regular (>6 un)', regular);

    doc.end();
  } catch (error) {
    console.error('Erro ao gerar relatorio:', error);
    next(error);
  }
}

module.exports = { gerarDashboardEstoquePdf };
