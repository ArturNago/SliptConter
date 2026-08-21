const { Pool } = require('pg');
const pool = new Pool({
  user: 'tebarrot', password: '141205',
  database: 'tebarrot_estoque', host: 'localhost', port: 5433,
});
async function run() {
  const client = await pool.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'conferencias'");
  console.log(res.rows);
  client.release();
  await pool.end();
}
run();
