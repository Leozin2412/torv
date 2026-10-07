const fs = require('fs');
const path = require('path');

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Fotos de perfil e capas de grupo. Ponto único de troca quando o storage migrar.
const UPLOAD_DIR = path.join(__dirname, '../../profilePhotos');

function hasValidImageSignature(buffer, mimetype) {
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimetype === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

// Lê o campo de arquivo da request e valida tipo + assinatura. Erros do próprio multipart (não é multipart etc.) sobem.
async function readImage(request, { maxBytes } = {}) {
  const data = await request.file(maxBytes ? { limits: { fileSize: maxBytes } } : undefined);
  if (!data) return { error: 'No image file provided', status: 400 };

  const ext = ALLOWED_IMAGE_TYPES[data.mimetype];
  if (!ext) return { error: 'File must be a JPEG, PNG, or WebP image', status: 400 };

  let buffer;
  try {
    buffer = await data.toBuffer();
  } catch (err) {
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') return { error: 'Image is too large', status: 413 };
    throw err;
  }
  if (data.file?.truncated) return { error: 'Image is too large', status: 413 };
  if (!hasValidImageSignature(buffer, data.mimetype)) {
    return { error: 'File content does not match a JPEG, PNG, or WebP image', status: 400 };
  }
  return { buffer, ext };
}

async function saveImage(fileName, buffer) {
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
}

// basename(): o nome vem do banco, mas nunca deixa sair da pasta de uploads.
async function deleteImage(fileName) {
  if (!fileName) return;
  await fs.promises.rm(path.join(UPLOAD_DIR, path.basename(fileName)), { force: true });
}

const publicUrl = (request, fileName) =>
  (fileName ? `${request.protocol}://${request.headers.host}/uploads/${fileName}` : null);

module.exports = { ALLOWED_IMAGE_TYPES, hasValidImageSignature, readImage, saveImage, deleteImage, publicUrl };
