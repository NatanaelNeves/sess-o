// Downscale + compress the Lumi kit for web use.
// Source PNGs are ~4MB each (huge canvases); the app renders them at <=230 CSS px,
// so 512px wide covers 2x retina. PNG palette compression keeps alpha + small size.
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIR = path.resolve("public/assets/kit");
const MAX = 512;

const files = (await readdir(DIR)).filter(f => f.endsWith(".png"));
let before = 0, after = 0;

for (const f of files) {
  const p = path.join(DIR, f);
  before += (await stat(p)).size;
  const buf = await sharp(p)
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  await sharp(buf).toFile(p);
  after += buf.length;
}

console.log(`${files.length} files: ${(before / 1e6).toFixed(0)}MB -> ${(after / 1e6).toFixed(1)}MB`);
