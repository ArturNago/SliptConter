/**
 * Model: produtos
 * Cadastro de produtos base (Produto Pai).
 */
const db = require('../config/db');

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM produtos WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByNome(nome, client = db) {
  const { rows } = await client.query(
    'SELECT * FROM produtos WHERE nome = $1 LIMIT 1',
    [nome]
  );
  return rows[0] || null;
}

async function create({
  nome,
  marca = null,
  categoria = null,
  peso_kg = null,
  dimensoes = null,
}, client = db) {
  const { rows } = await client.query(
    `INSERT INTO produtos
       (nome, marca, categoria, peso_kg, dimensoes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [nome, marca, categoria, peso_kg, dimensoes]
  );
  return rows[0];
}

async function update(id, {
  nome,
  marca,
  categoria,
  peso_kg,
  dimensoes,
  ativo,
}) {
  const { rows } = await db.query(
    `UPDATE produtos
     SET nome = COALESCE(NULLIF($2, ''), nome),
         marca = COALESCE(NULLIF($3, ''), marca),
         categoria = COALESCE(NULLIF($4, ''), categoria),
         peso_kg = COALESCE($5, peso_kg),
         dimensoes = COALESCE(NULLIF($6, ''), dimensoes),
         ativo = COALESCE($7, ativo),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, nome, marca, categoria, peso_kg, dimensoes, ativo]
  );
  return rows[0] || null;
}

module.exports = { findById, findByNome, create, update };
