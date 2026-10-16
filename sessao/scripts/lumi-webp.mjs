// Gera uma cópia .webp de cada pose do kit do Lumi.
// O app web carrega os .webp (bem mais leves); os .png continuam sendo a fonte
// do kit e são usados pelo app nativo e pelos scripts de ícone.
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIR = path.resolve("public/assets/kit");

const files = (await readdir(DIR)).filter(f => f.endsWith(".png"));
let before = 0, after = 0;

for (const f of files) {
  const src = path.join(DIR, f);
  const out = src.replace(/\.png$/, ".webp");
  before += (await stat(src)).size;
  const info = await sharp(src).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(out);
  after += info.size;
}

console.log(`${files.length} poses: ${(before / 1e6).toFixed(1)}MB png -> ${(after / 1e6).toFixed(1)}MB webp`);
