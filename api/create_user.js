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
    await pool.query("CREATE USER tebarrot WITH PASSWORD '141205'");
    console.log('Usuario tebarrot criado');
    await pool.query('GRANT ALL PRIVILEGES ON DATABASE tebarrot_estoque TO tebarrot');
    console.log('Privilegios concedidos');
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
}

main();
