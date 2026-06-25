// Generates generic SVG placeholder gallery images for development.
// Run once after cloning: node client/scripts/gen-placeholders.mjs
// Replace with real photos before deploying: drop JPGs into public/images/gallery/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images', 'gallery');
fs.mkdirSync(outDir, { recursive: true });

for (let i = 1; i <= 6; i++) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#cccccc"/>
  <text x="300" y="195" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#666666">תמונה ${i}</text>
  <text x="300" y="235" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#888888">החלף בתמונה אמיתית</text>
</svg>`;
  fs.writeFileSync(path.join(outDir, `${i}.jpg`), svg);
}

console.log(`Wrote 6 SVG placeholders to ${outDir}`);
console.log('Replace each file with a real JPEG photo before deployment.');
