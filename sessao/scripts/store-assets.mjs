// Gera o ícone e a tela de abertura do app iOS e as artes das lojas a partir
// do medalhão do Lumi em alta resolução. Rode depois de `npx cap add ios`.
//   ios/App/App/Assets.xcassets/...  ícone 1024 (sem transparência) e splash
//   store/                            ícone 512 do Google Play, gráfico de recursos 1024x500
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CACAU = "#170f12";
const MEDALHAO = "../assetsLumi/lumi_kit/ui/lumi_ui_icone_redondo.png";
const XCASSETS = path.resolve("ios/App/App/Assets.xcassets");
const STORE = path.resolve("store");

// fundo do ícone do PWA: a sala escura com o brilho do projetor no alto
const sala = (w, h) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="g" cx="50%" cy="22%" r="75%">
    <stop offset="0" stop-color="#3b2a1d"/><stop offset=".55" stop-color="#1c1419"/><stop offset="1" stop-color="${CACAU}"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/></svg>`);

// o arquivo do kit tem fundo semitransparente: só o medalhão (r≈748 em 1920) entra
async function medalhao(size) {
  const disco = Buffer.from(`<svg width="1920" height="1920"><circle cx="960" cy="960" r="748"/></svg>`);
  const disco1920 = await sharp(MEDALHAO).ensureAlpha()
    .composite([{ input: disco, blend: "dest-in" }])
    .png().toBuffer();
  // o sharp recorta antes de compor, por isso o recorte é um passo à parte
  const recortado = await sharp(disco1920).extract({ left: 212, top: 212, width: 1496, height: 1496 }).png().toBuffer();
  return sharp(recortado).resize(size, size).png().toBuffer();
}

// o sharp compõe depois de achatar: tirar o canal alfa é sempre um passo à parte
const semAlfa = async img => sharp(await img.png().toBuffer()).flatten({ background: CACAU }).png();

async function icone(size) {
  const img = sharp(sala(size, size))
    .composite([{ input: await medalhao(Math.round(size * 0.68)), gravity: "center" }]);
  return (await semAlfa(img)).toBuffer(); // a App Store recusa ícone com canal alfa
}

await mkdir(STORE, { recursive: true });

const icone1024 = await icone(1024);
await sharp(icone1024).toFile(path.join(XCASSETS, "AppIcon.appiconset/AppIcon-512@2x.png"));
await sharp(icone1024).toFile(path.join(STORE, "app-store-icon-1024.png"));
await sharp(await icone(512)).toFile(path.join(STORE, "play-icon-512.png"));

// splash do iOS: o mesmo Lumi projetando do splash do Android
const lumi = await sharp("public/assets/kit/projetando_luz.png").resize(1100, 1100).toBuffer();
const splash = await sharp({ create: { width: 2732, height: 2732, channels: 3, background: CACAU } })
  .composite([{ input: lumi, gravity: "center" }]).png().toBuffer();
for (const nome of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await sharp(splash).toFile(path.join(XCASSETS, "Splash.imageset", nome));
}

// gráfico de recursos do Google Play (1024x500, sem transparência) — provisório
const grafico = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <text x="470" y="235" font-family="Georgia, serif" font-size="88" font-weight="700" fill="#f6f1ea">Sessão</text>
  <text x="474" y="295" font-family="Georgia, serif" font-size="30" fill="#d9b85d">O diário cinematográfico do casal</text>
</svg>`);
await (await semAlfa(sharp(sala(1024, 500))
  .composite([{ input: await medalhao(340), left: 80, top: 80 }, { input: grafico, left: 0, top: 0 }])))
  .toFile(path.join(STORE, "play-feature-graphic-1024x500.png"));

console.log("ícone/splash do iOS e artes das lojas gerados");
