/**
 * Upload de fotos das pilhas/paletes (1 foto = 1 pilha).
 * Salva sempre em /dataset/inbound — a promoção para train/val é feita
 * pelo worker de IA (V1), nunca diretamente pela API.
 */
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const inboundDir = path.join(env.datasetPath, 'inbound');
fs.mkdirSync(inboundDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, inboundDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!permitidos.includes(file.mimetype)) {
    return cb(new Error('Formato de imagem não suportado.'));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

/**
 * Caminho relativo (para salvar em url_imagem_local), a partir do
 * caminho absoluto gerado pelo multer.
 */
function caminhoRelativo(absolutePath) {
  return path.relative(env.datasetPath, absolutePath).replace(/\\/g, '/');
}

module.exports = { upload, caminhoRelativo };
