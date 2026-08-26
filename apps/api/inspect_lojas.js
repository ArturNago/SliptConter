const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../vendas24_08.xlsx');
const wb = XLSX.readFile(filePath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(sheet);

const lojas = new Set();
const plataformas = new Set();
const skus = new Set();

json.forEach(r => {
  if (r['Nome da Loja no UpSeller']) lojas.add(r['Nome da Loja no UpSeller']);
  if (r['Plataformas']) plataformas.add(r['Plataformas']);
  if (r['SKU']) skus.add(r['SKU']);
});

console.log('Lojas encontradas:', Array.from(lojas));
console.log('Plataformas encontradas:', Array.from(plataformas));
console.log('Total SKUs distintos na planilha:', skus.size);
