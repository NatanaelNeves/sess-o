import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const kit = path.resolve(here, "../public/assets/kit");

const onboardingAssets = [
  "acenando.png",
  "abracando_coracao.png",
];

test("onboarding Lumi assets keep transparent corners", async () => {
  for (const file of onboardingAssets) {
    const { data, info } = await sharp(path.join(kit, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const border = Math.max(8, Math.round(Math.min(info.width, info.height) * 0.08));
    let visiblePixels = 0;
    let borderPixels = 0;

    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const inCorner = (x < border || x >= info.width - border)
          && (y < border || y >= info.height - border);
        if (!inCorner) continue;
        const alpha = data[(y * info.width + x) * info.channels + 3];
        borderPixels += 1;
        if (alpha > 12) visiblePixels += 1;
      }
    }

    const visibleRatio = visiblePixels / borderPixels;
    assert.ok(
      visibleRatio === 0,
      `${file} has a visible background in ${(visibleRatio * 100).toFixed(1)}% of its corners`,
    );
  }
});

// O avatar do cabeçalho virou o Lumi companheiro da plateia — a regra continua: sem halo pintado atrás
test("the Home Lumi companion has no painted halo behind it", async () => {
  const cssPath = path.resolve(here, "ui/cabine.css");
  const css = await import("node:fs/promises").then(fs => fs.readFile(cssPath, "utf8"));
  const rule = css.match(/\.lumi-co__hit\s*\{([^}]+)\}/)?.[1] || "";

  assert.match(rule, /background:\s*transparent\s*;/, "the Home companion paints a backdrop behind Lumi");
});
