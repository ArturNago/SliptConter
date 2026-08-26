const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  database: 'tebarrot_estoque',
  host: 'localhost',
  port: 5432
});

async function main() {
  try {
    await pool.query('GRANT ALL ON SCHEMA public TO tebarrot');
    console.log('GRANT schema public');
    await pool.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO tebarrot');
    console.log('GRANT all tables');
    await pool.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO tebarrot');
    console.log('GRANT all sequences');
    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO tebarrot');
    console.log('ALTER default privileges tables');
    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO tebarrot');
    console.log('ALTER default privileges sequences');
    console.log('Permissoes concedidas com sucesso!');
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
}

main();
