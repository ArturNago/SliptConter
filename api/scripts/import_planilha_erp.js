const xlsx = require('xlsx');
const path = require('path');
const db = require('../src/config/db');
const Produto = require('../src/models/Produto');
const Sku = require('../src/models/Sku');
const MapeamentoAnuncio = require('../src/models/MapeamentoAnuncio');

async function main() {
  const filePath = path.join(__dirname, '..', 'PLANILHA_TODOS_ANUNCIOS.xlsx');
  console.log(`Lendo planilha de: ${filePath}`);
  
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`Total de linhas encontradas: ${data.length}`);
  
  let novosProdutos = 0;
  let novosSkus = 0;
  let mapeamentosCriados = 0;
  let mapeamentosAtualizados = 0;

  for (const row of data) {
    const skuErp = String(row['SKU'] || '').trim();
    const skuTebarrot = String(row['Código do Produto'] || '').trim();
    const titulo = String(row['Título'] || '').trim();
    const variante = String(row['Variante1'] || '').trim();
    const codigoBarras = String(row['Código de Barras'] || '').trim();
    const marca = String(row['Marca'] || '').trim();
    
    // Parse weight and dimensions
    const pesoRaw = parseFloat(row['Peso (g)']);
    const pesoKg = !isNaN(pesoRaw) ? pesoRaw / 1000 : null;
    
    const comp = row['Comprimento (cm)'] || '';
    const larg = row['Largura (cm)'] || '';
    const alt = row['Altura (cm)'] || '';
    const dimensoes = [comp, larg, alt].filter(Boolean).join('x') || null;

    if (!skuErp || !skuTebarrot) {
      console.warn(`[Aviso] Linha ignorada - SKU ERP ou Código do Produto vazio: ${titulo}`);
      continue;
    }

    try {
      // 1. Garantir que o Sku Tebarrot existe
      let skuRecord = await Sku.findBySkuEnriched(skuTebarrot);
      
      if (!skuRecord) {
        // Se o SKU não existe, verifica se o Produto (Pai) existe pelo nome (Título sem variação)
        let produtoRecord = await Produto.findByNome(titulo);
        
        if (!produtoRecord) {
          produtoRecord = await Produto.create({
            nome: titulo,
            marca: marca || null,
            categoria: null,
            peso_kg: pesoKg,
            dimensoes: dimensoes
          });
          novosProdutos++;
        }
        
        // Cria a variação (Sku)
        skuRecord = await Sku.create({
          produto_id: produtoRecord.id,
          sku: skuTebarrot,
          descricao: variante ? `${titulo} - ${variante}` : titulo,
          codigoBarrasEan: codigoBarras || null
        });
        novosSkus++;
      }

      // 2. Garantir o mapeamento do SKU ERP
      let mapeamento = await MapeamentoAnuncio.findBySkuErp(skuErp);
      
      if (mapeamento) {
        // Atualiza se necessário
        if (mapeamento.sku_id !== skuRecord.id || mapeamento.nome_anuncio !== titulo) {
          await MapeamentoAnuncio.update(mapeamento.id, {
            nome_anuncio: titulo,
            variacao: variante,
            sku_id: skuRecord.id,
            sku_erp: skuErp
          });
          mapeamentosAtualizados++;
        }
      } else {
        // Verifica se já existe um mapeamento por nome/variacao para atualizar
        let mapeamentoAntigo = await MapeamentoAnuncio.findByAnuncio(titulo, variante);
        if (mapeamentoAntigo) {
           await MapeamentoAnuncio.update(mapeamentoAntigo.id, {
             nome_anuncio: titulo,
             variacao: variante,
             sku_id: skuRecord.id,
             sku_erp: skuErp
           });
           mapeamentosAtualizados++;
        } else {
           await MapeamentoAnuncio.create({
             nome_anuncio: titulo,
             variacao: variante,
             sku_id: skuRecord.id,
             sku_erp: skuErp
           });
           mapeamentosCriados++;
        }
      }

    } catch (error) {
      console.error(`Erro ao processar linha (SKU ERP: ${skuErp}, Tebarrot: ${skuTebarrot}):`, error.message);
    }
  }

  console.log('--- Resumo da Importação ---');
  console.log(`Novos Produtos (Pai): ${novosProdutos}`);
  console.log(`Novos SKUs (Variações): ${novosSkus}`);
  console.log(`Mapeamentos Criados: ${mapeamentosCriados}`);
  console.log(`Mapeamentos Atualizados: ${mapeamentosAtualizados}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
