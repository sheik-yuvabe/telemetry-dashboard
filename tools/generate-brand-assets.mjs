// Run from the repository root: node tools/generate-brand-assets.mjs
// The supplied SVG is canonical; PNGs retain its original colors.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/yuvabe-education-logo.svg');

async function png(destination, size, tile = false, ratio = .78) {
  const mark = await sharp(source, { density: 1200 })
    .resize(Math.round(size * (tile ? ratio : 1)), Math.round(size * (tile ? ratio : 1)), { fit: 'inside' })
    .png().toBuffer();
  const output = tile
    ? sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
        .composite([{ input: mark, gravity: 'centre' }]).png()
    : sharp(mark);
  await output.toFile(path.join(root, destination));
}

async function main() {
  await png('mobile/assets/yuvabe-education-logo.png', 512);
  for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
    await png('mobile/android/app/src/main/res/mipmap-' + density + '/ic_launcher.png', size, true);
  }
  const ios = 'mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset';
  const catalog = JSON.parse(await fs.readFile(path.join(root, ios, 'Contents.json'), 'utf8'));
  const done = new Set();
  for (const entry of catalog.images) {
    if (done.has(entry.filename)) continue;
    done.add(entry.filename);
    await png(ios + '/' + entry.filename, Math.round(parseFloat(entry.size) * parseFloat(entry.scale)), true);
  }
  for (const size of [192, 512]) {
    await png('mobile/web/icons/Icon-' + size + '.png', size, true);
    await png('mobile/web/icons/Icon-maskable-' + size + '.png', size, true, .6);
  }
  await png('mobile/web/favicon.png', 32, true);
  const icon = await fs.readFile(path.join(root, 'mobile/web/favicon.png'));
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header[6] = 32; header[7] = 32;
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(icon.length, 14); header.writeUInt32LE(22, 18);
  await fs.writeFile(path.join(root, 'app/favicon.ico'), Buffer.concat([header, icon]));
  console.log('Generated Flutter logo, Android/iOS/web icons, and favicon from the supplied SVG.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
