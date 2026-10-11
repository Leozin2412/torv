const path = require('path');

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const CONTENT_TYPES = Object.fromEntries(Object.entries(ALLOWED_IMAGE_TYPES).map(([type, ext]) => [ext, type]));

// Vercel recusa corpo > 4,5 MB.
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

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
async function readImage(request, { maxBytes = IMAGE_MAX_BYTES } = {}) {
  const data = await request.file({ limits: { fileSize: maxBytes } });
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

// Fotos de perfil e capas de grupo no Supabase Storage. Env lida na chamada, não no require.
// Erros só carregam o status: nunca a chave, a URL nem o corpo da resposta.
function storage() {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, SUPABASE_STORAGE_BUCKET: bucket } = process.env;
  const missing = Object.entries({ SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, SUPABASE_STORAGE_BUCKET: bucket })
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing storage env: ${missing.join(', ')}`);
  return { url, bucket, auth: { apikey: key, Authorization: `Bearer ${key}` } };
}

async function saveImage(fileName, buffer) {
  const { url, bucket, auth } = storage();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURIComponent(fileName)}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': CONTENT_TYPES[path.extname(fileName).toLowerCase()] || 'application/octet-stream' },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Image upload failed with status ${res.status}`);
}

// basename(): o nome vem do banco, mas nunca deixa sair do bucket. 404 = já não existe = ok.
async function deleteImage(fileName) {
  if (!fileName) return;
  const { url, bucket, auth } = storage();
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURIComponent(path.basename(fileName))}`, {
    method: 'DELETE',
    headers: auth,
  });
  if (!res.ok && res.status !== 404) throw new Error(`Image delete failed with status ${res.status}`);
}

function publicUrl(fileName) {
  if (!fileName) return null;
  const { url, bucket } = storage();
  return `${url}/storage/v1/object/public/${bucket}/${fileName}`;
}

module.exports = { ALLOWED_IMAGE_TYPES, IMAGE_MAX_BYTES, hasValidImageSignature, readImage, saveImage, deleteImage, publicUrl };
