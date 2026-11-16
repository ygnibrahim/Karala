// scripts/icon.svg dosyasından PWA ve iOS için gereken PNG ikonları üretir.
// Kullanım: npm run icons -w client
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const src = new URL('./icon.svg', import.meta.url);
const outDir = new URL('../public/icons/', import.meta.url);
const svg = await readFile(src);
await mkdir(outDir, { recursive: true });

const outputs = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];

for (const [name, size] of outputs) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(fileURLToPath(new URL(name, outDir)));
  console.log('✓', name);
}
