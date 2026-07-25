import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

// O plano gratuito do Firebase não inclui Storage, então o álbum das sessões
// mora no próprio Firestore. Cada foto é comprimida no navegador e guardada
// como data URL num documento só dela — o teto de 1 MiB do Firestore é POR
// documento, e a entrada do acervo continua leve porque só registra quais
// fotos existem (o `photos` dela é um mapa de flags, não de imagens).
export const MAX_PHOTO_DOC_BYTES = 600 * 1024;

// tentativas em ordem: a primeira que couber no documento vence
const COMPRESSION_STEPS = [
  { maxDim: 1100, quality: 0.72 },
  { maxDim: 900,  quality: 0.62 },
  { maxDim: 720,  quality: 0.55 },
  { maxDim: 560,  quality: 0.45 },
];

const loadImage = file => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load failed")); };
  img.src = url;
});

const drawToDataUrl = (img, maxDim, quality) => {
  let { width, height } = img;
  if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
  else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
};

// comprime até caber num documento do Firestore (base64 é ASCII, então
// o tamanho em caracteres é o tamanho em bytes)
export const compressPhotoToDataUrl = async file => {
  const img = await loadImage(file);
  for (const step of COMPRESSION_STEPS) {
    const out = drawToDataUrl(img, step.maxDim, step.quality);
    if (out.length <= MAX_PHOTO_DOC_BYTES) return out;
  }
  throw new Error("compress failed");
};

// um álbum por sessão; o id é gerado no cliente para funcionar tanto ao criar
// (quando o documento do acervo ainda não existe) quanto ao editar
export const newAlbumId = () => (
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
);

const photoDoc = (coupleId, albumId, kind) =>
  doc(db, "couples", coupleId, "photos", `${albumId}__${kind}`);

export const savePhoto = (coupleId, albumId, kind, dataUrl) =>
  setDoc(photoDoc(coupleId, albumId, kind), {
    albumId, kind, data: dataUrl, createdAt: new Date().toISOString(),
  });

export const removePhoto = (coupleId, albumId, kind) =>
  deleteDoc(photoDoc(coupleId, albumId, kind));

// carrega só as fotos que a entrada diz ter — no máximo uma leitura por foto,
// e só quando alguém abre o álbum
export const loadAlbum = async (coupleId, albumId, kinds) => {
  if (!coupleId || !albumId || !kinds?.length) return {};
  const snaps = await Promise.all(kinds.map(k => getDoc(photoDoc(coupleId, albumId, k))));
  const out = {};
  snaps.forEach((snap, i) => { if (snap.exists()) out[kinds[i]] = snap.data().data; });
  return out;
};

// quais fotos essa entrada tem — aceita tanto o mapa de flags novo quanto o
// mapa de URLs antigo (Storage), já que os dois têm as mesmas chaves
export const albumKinds = entry => Object.entries(entry?.photos || {})
  .filter(([, v]) => !!v)
  .map(([k]) => k);
