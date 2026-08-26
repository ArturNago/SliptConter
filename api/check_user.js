require('dotenv').config({ path: '../.env' });
require('dotenv').config();
const db = require('./src/config/db');

async function check() {
  try {
    const { rows } = await db.query('SELECT id, nome, username, senha, papel, ativo, created_at FROM usuarios');
    console.log('--- Usuários Cadastrados no Banco ---');
    console.table(rows);

    const artur = rows.find(r => 
      (r.username && r.username.toLowerCase().includes('artur')) || 
      (r.nome && r.nome.toLowerCase().includes('artur')) ||
      r.senha === '9241'
    );
    console.log('\nBusca por Artur / 9241:');
    console.log(artur || 'Nenhum usuário encontrado com esses critérios');
  } catch (err) {
    console.error('Erro ao consultar banco:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
