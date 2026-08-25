/**
 * Verificação de sanidade dos módulos da API
 */
const fs = require('fs');
const path = require('path');

console.log('[test] Carregando todos os módulos e controllers...');

try {
  require('./src/models/Armazem');
  require('./src/models/Conferencia');
  require('./src/models/MapeamentoAnuncio');
  require('./src/models/MovimentacaoEstoque');
  require('./src/models/Produto');
  require('./src/models/Sku');
  require('./src/models/Usuario');
  require('./src/models/LoteImportacaoVendas');
  require('./src/models/PedidoVendaImportado');
  require('./src/models/OrdemInventario');
  console.log('✅ Models carregados com sucesso.');

  require('./src/services/ledgerService');
  require('./src/services/conferenciaService');
  require('./src/services/vendasImportService');
  require('./src/services/inventarioService');
  require('./src/services/pcpService');
  console.log('✅ Services carregados com sucesso.');

  require('./src/controllers/adminController');
  require('./src/controllers/armazensController');
  require('./src/controllers/authController');
  require('./src/controllers/conferenciasController');
  require('./src/controllers/importacaoVendasController');
  require('./src/controllers/inventariosController');
  require('./src/controllers/mapeamentosController');
  require('./src/controllers/movimentacoesController');
  require('./src/controllers/pcpController');
  require('./src/controllers/produtosController');
  console.log('✅ Controllers carregados com sucesso.');

  require('./src/routes/index');
  console.log('✅ Rotas carregadas com sucesso.');

  console.log('🎉 Todos os módulos da API compilaram e foram carregados perfeitamente!');
} catch (err) {
  console.error('❌ Erro ao carregar módulos:', err);
  process.exit(1);
}
