// Gera o ícone e a tela de abertura do app Android (Capacitor) a partir dos
// ícones do PWA e do kit do Lumi. Rode depois de `npx cap add android`.
import sharp from "sharp";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RES = path.resolve("capacitor-android/app/src/main/res");
const CACAU = "#170f12";
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [d, k] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${d}`);
  const icon = Math.round(48 * k);
  await sharp("public/icon-512.png").resize(icon, icon).png().toFile(path.join(dir, "ic_launcher.png"));
  await sharp("public/icon-512.png").resize(icon, icon)
    .composite([{ input: Buffer.from(`<svg width="${icon}" height="${icon}"><circle cx="${icon / 2}" cy="${icon / 2}" r="${icon / 2}"/></svg>`), blend: "dest-in" }])
    .png().toFile(path.join(dir, "ic_launcher_round.png"));
  // ícone adaptativo: 108dp, com a arte na zona segura central de 72dp
  const fg = Math.round(108 * k);
  await sharp("public/icon-512-maskable.png").resize(fg, fg).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
}

await writeFile(path.join(RES, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${CACAU}</color>\n</resources>\n`);

// tela de abertura: o Lumi projetando, no escuro da sala
const lumi = "public/assets/kit/projetando_luz.png";
for (const dir of (await readdir(RES)).filter(d => d.startsWith("drawable"))) {
  const file = path.join(RES, dir, "splash.png");
  let meta;
  try { meta = await sharp(file).metadata(); } catch { continue; }
  const size = Math.round(Math.min(meta.width, meta.height) * 0.42);
  const art = await sharp(lumi).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const out = await sharp({ create: { width: meta.width, height: meta.height, channels: 4, background: CACAU } })
    .composite([{ input: art, gravity: "center" }]).png().toBuffer();
  await writeFile(file, out);
}
console.log("ícones e splash do Android gerados");
