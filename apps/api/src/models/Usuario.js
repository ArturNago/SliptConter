/**
 * Model: usuarios
 * Login tradicional por username + senha.
 */
const db = require('../config/db');

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByUsername(username) {
  const { rows } = await db.query(
    'SELECT * FROM usuarios WHERE LOWER(username) = LOWER($1) AND ativo = TRUE',
    [username]
  );
  return rows[0] || null;
}

async function create({ nome, username, senha, papel = 'operador' }) {
  const { rows } = await db.query(
    `INSERT INTO usuarios (nome, username, senha, papel)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nome, username, senha, papel]
  );
  return rows[0];
}

async function updateSenha(id, senhaHash) {
  await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [senhaHash, id]);
}

module.exports = {
  findById,
  findByUsername,
  create,
  updateSenha,
};
