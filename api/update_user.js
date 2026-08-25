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
    await pool.query("ALTER USER tebarrot WITH PASSWORD '9241'");
    console.log('Senha do usuario tebarrot atualizada');
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
}

main();
