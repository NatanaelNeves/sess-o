export const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;

export const resolvePhotoUploadCoupleId = (coupleId, fallbackCoupleId) => {
  return coupleId || fallbackCoupleId || null;
};

export const getPhotoUploadErrorMessage = (file, error) => {
  if (!file) return null;
  if (!file.type || !file.type.startsWith("image/")) {
    return "Formato não suportado. Escolha uma imagem JPG, PNG ou WebP.";
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return "A imagem é grande demais. Escolha uma foto menor que 8 MB.";
  }
  if (error?.message === "compress failed") {
    return "Não foi possível processar essa imagem. Tente outra foto.";
  }
  if (error?.message === "load failed") {
    return "Não foi possível carregar essa imagem. Tente outra foto.";
  }
  if (error) {
    return "Não foi possível enviar a foto. Tente novamente.";
  }
  return null;
};
