const Armazem = require('../models/Armazem');

async function listar(req, res, next) {
  try {
    const ativo = req.query.ativo === undefined ? true : req.query.ativo !== 'false';
    return res.json(await Armazem.list({ ativo }));
  } catch (err) {
    return next(err);
  }
}

async function criar(req, res, next) {
  try {
    const nome = String(req.body.nome || '').trim();
    const codigo = String(req.body.codigo || '').trim().toUpperCase() || null;
    if (!nome) return res.status(400).json({ erro: 'Nome do armazém é obrigatório.' });

    const armazem = await Armazem.create({ nome, codigo });
    return res.status(201).json(armazem);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Código de armazém já cadastrado.' });
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const payload = {
      nome: req.body.nome === undefined ? undefined : String(req.body.nome).trim(),
      codigo: req.body.codigo === undefined ? undefined : String(req.body.codigo).trim().toUpperCase(),
      ativo: req.body.ativo === undefined
        ? undefined
        : req.body.ativo === true || req.body.ativo === 'true',
    };
    if (payload.nome === '') return res.status(400).json({ erro: 'Nome do armazém não pode ficar vazio.' });

    const armazem = await Armazem.update(req.params.id, payload);
    if (!armazem) return res.status(404).json({ erro: 'Armazém não encontrado.' });
    return res.json(armazem);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Código de armazém já cadastrado.' });
    return next(err);
  }
}

async function estoque(req, res, next) {
  try {
    const armazem = await Armazem.findById(req.params.id);
    if (!armazem) return res.status(404).json({ erro: 'Armazém não encontrado.' });
    return res.json(await Armazem.estoque(req.params.id));
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, criar, atualizar, estoque };
