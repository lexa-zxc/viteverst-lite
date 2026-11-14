// Тест настроек оптимизации изображений (npm run img:test)
// Берёт до 3 JPEG и до 2 PNG из app/img, прогоняет варианты качества
// из IMAGE_OPTIMIZATION и соседних, считает вес и PSNR, собирает
// визуальные сравнения (кропы 2x) в .cache/img-test/.
//
// PSNR (против несжатого оригинала): >40 dB — визуально прозрачное,
// 35–40 — очень хорошо, <35 — артефакты видны при пристальном взгляде.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'app', 'img');
const OUT = path.join(ROOT, '.cache', 'img-test');
fs.mkdirSync(OUT, { recursive: true });

const fmt = (b) => (b / 1024).toFixed(1) + ' KB';

async function psnrVs(originalPath, compressedPath) {
  const A = await sharp(originalPath).flatten({ background: '#ffffff' }).raw().toBuffer();
  const B = await sharp(compressedPath).flatten({ background: '#ffffff' }).raw().toBuffer();
  let se = 0;
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const d = A[i] - B[i];
    se += d * d;
  }
  const mse = se / n;
  return mse === 0 ? 'inf' : (10 * Math.log10(255 * 255 / mse)).toFixed(2);
}

function findImages(exts, limit) {
  const found = [];
  const walk = (dir) => {
    if (found.length >= limit) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (exts.includes(path.extname(entry.name).toLowerCase())) found.push(full);
      if (found.length >= limit) return;
    }
  };
  walk(SRC);
  return found;
}

async function jpegTest(p, qualities) {
  const name = path.basename(p);
  const meta = await sharp(p).metadata();
  const origSize = fs.statSync(p).size;
  console.log(`\n=== JPEG ${name} (${meta.width}x${meta.height}, ${fmt(origSize)}) ===`);
  const outs = [];
  for (const q of qualities) {
    const out = path.join(OUT, `${name}.q${q}.jpg`);
    await sharp(p).jpeg({ quality: q, mozjpeg: true }).toFile(out);
    const size = fs.statSync(out).size;
    const psnr = await psnrVs(p, out);
    console.log(`  mozjpeg q${q}: ${fmt(size)} (-${Math.round((1 - size / origSize) * 100)}%) PSNR ${psnr} dB`);
    outs.push(out);
  }
  return { p, meta, name, outs };
}

async function pngTest(p, variants) {
  const name = path.basename(p);
  const meta = await sharp(p).metadata();
  const origSize = fs.statSync(p).size;
  console.log(`\n=== PNG ${name} (${meta.width}x${meta.height}, ${fmt(origSize)}, alpha: ${meta.hasAlpha}) ===`);
  const outs = [];
  for (const [label, opts] of Object.entries(variants)) {
    const out = path.join(OUT, `${name}.${label}.png`);
    await sharp(p).png(opts).toFile(out);
    const size = fs.statSync(out).size;
    const psnr = await psnrVs(p, out);
    console.log(`  ${label}: ${fmt(size)} (-${Math.round((1 - size / origSize) * 100)}%) PSNR ${psnr} dB`);
    outs.push({ label, out });
  }
  return { p, meta, name, outs };
}

// Сравнительная лента: один и тот же кроп 2x (nearest) из разных вариантов
async function compareStrip(base, variants, outFile) {
  const W = 320, H = 320, LABEL_H = 28;
  const firstMeta = await sharp(variants[0].path).metadata();
  const crop = {
    left: Math.max(0, Math.floor(firstMeta.width / 2) - W / 2),
    top: Math.max(0, Math.floor(firstMeta.height / 2) - H / 2),
    width: W, height: H
  };
  const comps = [];
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const pipeline = sharp(v.path).extract(crop);
    if (firstMeta.hasAlpha) pipeline.flatten({ background: '#ffffff' });
    const buf = await pipeline.resize(W, H, { kernel: 'nearest' }).toBuffer();
    comps.push({ input: buf, left: i * W, top: LABEL_H });
    const svg = Buffer.from(
      `<svg width="${W}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#111"/><text x="50%" y="20" font-size="14" fill="#fff" text-anchor="middle" font-family="sans-serif">${v.label}</text></svg>`
    );
    comps.push({ input: svg, left: i * W, top: 0 });
  }
  await sharp({ create: { width: variants.length * W, height: H + LABEL_H, channels: 3, background: '#000' } })
    .composite(comps)
    .jpeg({ quality: 95 })
    .toFile(outFile);
  console.log(`  визуальное сравнение: ${outFile}`);
}

// === Прогон ===

// Плавный градиент — худший случай для палитры (бандинг)
async function makeGradientPng() {
  const w = 1200, h = 800;
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      buf[o] = 40 + Math.round((x / w) * 120 + (y / h) * 40);
      buf[o + 1] = 60 + Math.round((x / w) * 30 + (y / h) * 90);
      buf[o + 2] = 90 + Math.round((x / w) * 100 + (y / h) * 130);
    }
  }
  const out = path.join(OUT, '_synthetic-gradient.png');
  await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 0 }).toFile(out);
  return out;
}

const jpegs = findImages(['.jpg', '.jpeg'], 3);
const pngs = findImages(['.png'], 2);
const gradient = await makeGradientPng();

console.log(`Найдено в app/img: ${jpegs.length} JPEG, ${pngs.length} PNG (+ синтетический градиент для теста палитры)`);

const jpegQualities = [70, 75, 80, 85];
const pngVariants = {
  pal80: { quality: 80, palette: true, compressionLevel: 9 },
  pal90: { quality: 90, palette: true, compressionLevel: 9 },
  truecolor: { compressionLevel: 9 }
};

const pngTargets = [...pngs, gradient].slice(0, 3);

console.log('\n############ JPEG ############');
const jpegResults = [];
for (const p of jpegs) jpegResults.push(await jpegTest(p, jpegQualities));

console.log('\n############ PNG ############');
const pngResults = [];
for (const p of pngTargets) pngResults.push(await pngTest(p, pngVariants));

console.log('\n--- Визуальные сравнения ---');
for (const j of jpegResults.slice(0, 1)) {
  await compareStrip(j.name, [
    { label: 'оригинал', path: j.p },
    ...j.outs.map((o, i) => ({ label: `q${jpegQualities[i]}`, path: o }))
  ], path.join(OUT, 'compare-jpeg.jpg'));
}
for (const r of pngResults) {
  await compareStrip(r.name, [
    { label: 'оригинал', path: r.p },
    ...r.outs.filter(o => o.label !== 'truecolor').map(o => ({ label: o.label, path: o.out }))
  ], path.join(OUT, `compare-${r.name}.jpg`));
}

console.log('\nГотово. Сравнения в .cache/img-test/');
