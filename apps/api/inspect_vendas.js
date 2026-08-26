const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../vendas24_08.xlsx');
try {
  const wb = XLSX.readFile(filePath);
  console.log('Sheet Names:', wb.SheetNames);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet);
  console.log('Total Linhas:', json.length);
  console.log('Primeiras 3 linhas:', JSON.stringify(json.slice(0, 3), null, 2));
} catch (e) {
  console.error('Erro ao ler planilha:', e.message);
}
