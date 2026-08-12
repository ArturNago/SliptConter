const readline = require('readline');
const { Pool } = require('pg');
const path = require('path');

// Tenta carregar o .env da raiz do projeto, ou do diretório atual
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config(); 

const host = process.env.POSTGRES_HOST === 'db' ? 'localhost' : (process.env.POSTGRES_HOST || 'localhost');
const port = process.env.POSTGRES_HOST === 'db' ? (parseInt(process.env.POSTGRES_HOST_PORT, 10) || 5433) : (parseInt(process.env.POSTGRES_PORT, 10) || 5432);

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || 'tebarrot',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: host,
  port: port,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('=================================');
  console.log('    Gerenciamento de Usuários    ');
  console.log('=================================');
  console.log('1 - Cadastrar novo usuário');
  console.log('2 - Excluir usuário');
  console.log('0 - Sair');
  console.log('=================================');
  
  const opcao = await question('Escolha uma opção: ');

  if (opcao === '1') {
    console.log('\n--- Cadastro de Usuário ---');
    const nome = await question('Nome: ');
    const pin = await question('Pin (Senha): ');

    try {
      const username = nome.trim();
      
      // Verifica se o usuário já existe
      const { rows } = await pool.query('SELECT id FROM usuarios WHERE username = $1', [username]);
      
      if (rows.length > 0) {
        console.log(`\nErro: Já existe um usuário com o nome "${username}".`);
      } else {
        await pool.query(
          `INSERT INTO usuarios (nome, username, senha, papel) VALUES ($1, $2, $3, 'operador')`,
          [nome.trim(), username, pin]
        );
        console.log(`\n✅ Usuário "${nome}" cadastrado com sucesso!`);
      }
    } catch (err) {
      const msg = err.message || JSON.stringify(err);
      console.error('\n❌ Erro ao cadastrar usuário:', msg);
    }
  } else if (opcao === '2') {
    console.log('\n--- Exclusão de Usuário ---');
    const nome = await question('Nome do usuário a excluir: ');

    try {
      const { rowCount } = await pool.query(
        `DELETE FROM usuarios WHERE nome = $1 OR username = $1`,
        [nome.trim()]
      );
      
      if (rowCount > 0) {
        console.log(`\n✅ Usuário "${nome}" excluído com sucesso!`);
      } else {
        console.log(`\n⚠️ Usuário "${nome}" não encontrado.`);
      }
    } catch (err) {
      const msg = err.message || JSON.stringify(err);
      console.error('\n❌ Erro ao excluir usuário:', msg);
    }
  } else if (opcao === '0') {
    console.log('\nSaindo...');
  } else {
    console.log('\nOpção inválida.');
  }

  rl.close();
  await pool.end();
}

main();
