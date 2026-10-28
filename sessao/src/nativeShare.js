// Compartilhar, salvar e abrir links dentro do app (Android/iOS via Capacitor).
// O WebView não baixa arquivos por <a download>, não abre window.open()/print()
// e, no Android, nem tem navigator.share. No app tudo isso vira a folha de
// compartilhamento nativa (que oferece "Salvar imagem", "Arquivos", agenda...)
// e o navegador do sistema. No navegador o comportamento continua o de sempre.
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Browser } from "@capacitor/browser";

const isNative = () => Capacitor.isNativePlatform();

// Dentro do app a origem é https://localhost (Android) ou capacitor://localhost
// (iOS): links que vão para outra pessoa precisam do endereço público do site.
export const PUBLIC_ORIGIN = "https://sess-80b2c.web.app";
export const publicOrigin = () => (isNative() ? PUBLIC_ORIGIN : window.location.origin);
export const SUPPORT_EMAIL = "natanaelnevesalves@gmail.com";

// Fechar a folha de compartilhamento não é erro.
const ignoreCancel = e => {
  if (!/cancel/i.test(e?.message || "")) throw e;
};

export const canShareText = () => isNative() || typeof navigator.share === "function";

export async function shareText({ title, text }) {
  if (isNative()) return Share.share({ title, text, dialogTitle: title }).catch(ignoreCancel);
  return navigator.share?.({ title, text });
}

// Páginas estáticas do site (privacidade, créditos): no app abrem no navegador
// interno do sistema, para não tirar o usuário do diário sem caminho de volta.
export function openSitePage(path) {
  if (isNative()) return Browser.open({ url: PUBLIC_ORIGIN + path });
  window.open(path, "_blank", "noopener");
}

const safeName = name => name.replace(/[^\w.-]+/g, "-");

async function shareNativeFile({ filename, data, encoding, title }) {
  const { uri } = await Filesystem.writeFile({
    path: safeName(filename),
    data,
    directory: Directory.Cache,
    ...(encoding ? { encoding } : {}),
  });
  return Share.share({ title, files: [uri], dialogTitle: title }).catch(ignoreCancel);
}

function downloadHref(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

// Imagem gerada no app (data:image/png;base64,...).
export async function shareImage(dataUrl, filename, title) {
  if (isNative()) {
    return shareNativeFile({ filename, data: dataUrl.slice(dataUrl.indexOf(",") + 1), title });
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title });
  } catch (e) {
    if (e?.name === "AbortError") return;
  }
  downloadHref(dataUrl, filename);
}

// No navegador, "Salvar" baixa direto; no app não há pasta de downloads
// acessível, então a folha nativa oferece "Salvar imagem"/"Salvar em Arquivos".
export function saveImage(dataUrl, filename, title) {
  if (isNative()) return shareImage(dataUrl, filename, title);
  downloadHref(dataUrl, filename);
}

// Arquivo de texto (convite de agenda .ics, exportação .html).
export async function saveTextFile(text, filename, mimeType, title) {
  if (isNative()) return shareNativeFile({ filename, data: text, encoding: Encoding.UTF8, title });
  const href = URL.createObjectURL(new Blob([text], { type: mimeType }));
  downloadHref(href, filename);
  URL.revokeObjectURL(href);
}
