require('dotenv').config({ path: '../.env' });
require('dotenv').config();
const Usuario = require('./src/models/Usuario');

async function test() {
  const user1 = await Usuario.findByUsername('Artur');
  const user2 = await Usuario.findByUsername('artur');
  const user3 = await Usuario.findByUsername('ARTUR');

  console.log('Busca "Artur":', user1?.nome, '| Senha confere:', user1?.senha === '9241', '| Papel:', user1?.papel);
  console.log('Busca "artur":', user2?.nome, '| Senha confere:', user2?.senha === '9241', '| Papel:', user2?.papel);
  console.log('Busca "ARTUR":', user3?.nome, '| Senha confere:', user3?.senha === '9241', '| Papel:', user3?.papel);
  process.exit(0);
}

test();
