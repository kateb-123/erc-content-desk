// Usage: node scripts/visual-diff.mjs <mockup.png> <screenshot.png> [diff.png]
// Prints a match percentage and writes a diff image (magenta = different).
// From docs/CLAUDE-FRONTEND-PLAYBOOK.md §5.5.
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [, , aPath, bPath, outPath = '.screens/diff.png'] = process.argv;
if (!aPath || !bPath) {
  console.error('usage: node scripts/visual-diff.mjs <mockup.png> <screenshot.png> [diff.png]');
  process.exit(2);
}

const a = PNG.sync.read(fs.readFileSync(aPath));
const b = PNG.sync.read(fs.readFileSync(bPath));

if (a.width !== b.width || a.height !== b.height) {
  console.warn(`size mismatch: mockup ${a.width}x${a.height} vs screenshot ${b.width}x${b.height}. ` +
    'Match the viewport to the mockup width before trusting the number.');
}

const width = Math.max(a.width, b.width);
const height = Math.max(a.height, b.height);

function pad(img) {
  if (img.width === width && img.height === height) return img;
  const p = new PNG({ width, height });
  p.data.fill(255);
  PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
  return p;
}

const A = pad(a);
const B = pad(b);
const diff = new PNG({ width, height });
const mismatched = pixelmatch(A.data, B.data, diff.data, width, height, {
  threshold: 0.1,
  diffColor: [255, 0, 255],
  alpha: 0.4,
});

fs.mkdirSync(outPath.includes('/') ? outPath.slice(0, outPath.lastIndexOf('/')) : '.', { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(diff));
const pct = (100 * (1 - mismatched / (width * height))).toFixed(2);
console.log(`match: ${pct}%  (${mismatched} of ${width * height} pixels differ)  diff -> ${outPath}`);
