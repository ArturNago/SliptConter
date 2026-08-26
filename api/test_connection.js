const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  host: 'localhost',
  port: 5432
});

async function main() {
  try {
    const userCheck = await pool.query("SELECT usename FROM pg_user WHERE usename = 'tebarrot'");
    console.log('Usuario tebarrot existe:', userCheck.rows.length > 0);

    await pool.query("ALTER USER tebarrot WITH PASSWORD '9241'");
    console.log('Senha atualizada para 9241');

    const testPool = new Pool({
      user: 'tebarrot',
      password: '9241',
      database: 'tebarrot_estoque',
      host: 'localhost',
      port: 5432
    });
    const testRes = await testPool.query('SELECT NOW()');
    console.log('Conexao tebarrot OK:', testRes.rows[0].now);
    await testPool.end();
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await pool.end();
  }
}

main();
