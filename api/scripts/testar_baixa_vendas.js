const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../src/config/db');
const MapeamentoAnuncio = require('../src/models/MapeamentoAnuncio');
const ledgerService = require('../src/services/ledgerService');
const Armazem = require('../src/models/Armazem');
const Usuario = require('../src/models/Usuario');

async function main() {
  const args = process.argv.slice(2);
  let fileName = args[0] || 'Export_Order20260811143214.xlsx';
  if (!fileName.endsWith('.xlsx')) fileName += '.xlsx';

  // Procura o arquivo na raiz do projeto primeiro
  let filePath = path.join(__dirname, '..', '..', fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[Aviso] Arquivo ${fileName} não encontrado em ${filePath}.`);
    // Fallback para o arquivo do dia 10 se existir
    filePath = path.join(__dirname, '..', '..', 'Export_Order20260810120035.xlsx');
    if (!fs.existsSync(filePath)) {
       console.error(`Erro: Nenhuma planilha de vendas encontrada.`);
       process.exit(1);
    }
    console.log(`Usando arquivo de fallback para o teste: Export_Order20260810120035.xlsx`);
  } else {
    console.log(`Usando arquivo fornecido: ${fileName}`);
  }

  console.log(`Lendo planilha de vendas...`);
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  console.log(`Total de itens vendidos (linhas): ${data.length}`);

  // Configurações base para o teste de estoque
  // 1. Pegar ou criar um armazém padrão para a saída
  let armazem = (await db.query('SELECT * FROM armazens LIMIT 1')).rows[0];
  if (!armazem) {
     armazem = await Armazem.create({ nome: 'Galpão Principal', tipo: 'interno' });
  }

  // 2. Pegar um usuário do sistema (operador)
  let operador = (await db.query('SELECT * FROM usuarios LIMIT 1')).rows[0];
  if (!operador) {
     const { create } = require('../src/models/Usuario');
     operador = await create({ nome: 'Sistema Integrador', email: 'sistema@tebarrot.com', senha: '123' });
  }

  let mapeamentosSucesso = 0;
  let mapeamentosFalha = 0;
  let baixasRealizadas = 0;

  for (const row of data) {
    const skuErp = String(row['SKU'] || '').trim();
    const qtdVendidaRaw = row['Qtd. do Produto'];
    const qtdVendida = parseInt(qtdVendidaRaw, 10);
    const nomeAnuncio = row['Nome do Anúncio'] || '';

    if (!skuErp) continue;
    if (isNaN(qtdVendida) || qtdVendida <= 0) continue;

    try {
      // MAPEAMENTO: Busca pelo SKU do ERP
      const mapeamento = await MapeamentoAnuncio.findBySkuErp(skuErp);

      if (mapeamento) {
        mapeamentosSucesso++;
        console.log(`[SUCESSO] Upseller SKU: ${skuErp} -> Tebarrot SKU: ${mapeamento.sku} (Produto: ${mapeamento.produto_nome})`);
        
        // BAIXA NO ESTOQUE: Lançar uma saída no ledger
        await ledgerService.registrarMovimentacao({
           skuId: mapeamento.sku_id,
           armazemId: armazem.id,
           tipo: 'saida',
           quantidade: -qtdVendida,
           idOperador: operador.id,
           observacao: `Venda Upseller - Anúncio: ${nomeAnuncio.substring(0, 50)}`
        });
        baixasRealizadas++;

      } else {
        mapeamentosFalha++;
        console.warn(`[FALHA] Não foi possível mapear o SKU ERP: ${skuErp} (Anúncio: ${nomeAnuncio})`);
      }
    } catch (error) {
       console.error(`Erro ao processar venda do SKU ${skuErp}: ${error.message}`);
    }
  }

  console.log('\n--- Resultado do Teste de Baixa de Vendas ---');
  console.log(`Itens lidos: ${data.length}`);
  console.log(`SKUs Mapeados com Sucesso: ${mapeamentosSucesso}`);
  console.log(`SKUs Não Encontrados: ${mapeamentosFalha}`);
  console.log(`Baixas no Estoque Realizadas: ${baixasRealizadas}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
