// scripts/icon.svg'deki logodan Android uygulamasının ikonlarını ve açılış ekranlarını üretir.
// Capacitor'ın varsayılan (mavi X) görsellerinin yerine Karala logosu kullanılır.
// Kullanım: npm run android:assets -w client
import { readdir, readFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const res = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
const svg = await readFile(new URL('./icon.svg', import.meta.url), 'utf8');

// Logonun çizimi (arka plan karesi hariç) — uyarlanabilir ikonun ön yüzü ve açılış ekranı için.
const art = svg.replace(/<rect width="512" height="512"[^>]*\/>/, '');
const bgDefs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
const svgOf = (viewBox, body, w, h) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}">${body}</svg>`);
const inner = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const png = (buf, size, file) =>
  sharp(buf, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(`${res}${file}`)
    .then(() => console.log('✓', file));

for (const [d, k] of Object.entries(densities)) {
  const legacy = Math.round(48 * k);
  // Eski Android: yuvarlatılmış kare ve daire ikon.
  const rounded = svgOf(
    '0 0 512 512',
    `<clipPath id="c"><rect width="512" height="512" rx="96"/></clipPath><g clip-path="url(#c)">${inner(svg)}</g>`,
    512,
    512,
  );
  const round = svgOf(
    '0 0 512 512',
    `<clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath><g clip-path="url(#c)">${inner(svg)}</g>`,
    512,
    512,
  );
  await png(rounded, legacy, `mipmap-${d}/ic_launcher.png`);
  await png(round, legacy, `mipmap-${d}/ic_launcher_round.png`);
  // Uyarlanabilir ikonun ön yüzü (108 dp). Logo ortadaki 72 dp'ye oturur; çizim güvenli alanda kalır.
  await png(svgOf('-128 -128 768 768', inner(art), 768, 768), Math.round(108 * k), `mipmap-${d}/ic_launcher_foreground.png`);
}

// Açılış ekranları: mevcut her splash.png aynı boyutta, mor degrade üstünde ortada logo.
const dirs = (await readdir(res)).filter((n) => n.startsWith('drawable'));
for (const dir of dirs) {
  const file = `${dir}/splash.png`;
  let meta;
  try {
    meta = await sharp(`${res}${file}`).metadata();
  } catch {
    continue;
  }
  const { width: w, height: h } = meta;
  const logo = Math.round(Math.min(w, h) * 0.62);
  const body =
    `${bgDefs}<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    `<svg x="${(w - logo) / 2}" y="${(h - logo) / 2}" width="${logo}" height="${logo}" viewBox="0 0 512 512">${inner(art)}</svg>`;
  await sharp(svgOf(`0 0 ${w} ${h}`, body, w, h))
    .png()
    .toFile(`${res}${file}.tmp`);
  await rename(`${res}${file}.tmp`, `${res}${file}`);
  console.log('✓', file, `${w}x${h}`);
}
