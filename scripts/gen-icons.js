// Simple icon generator using sharp: converts public/vite.svg to PNGs required by PWA
// Outputs:
// - public/icons/icon-192.png
// - public/icons/icon-512.png
// - public/apple-touch-icon.png (180x180)

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function ensureDir(dir){
  await fs.promises.mkdir(dir, { recursive: true }).catch(()=>{});
}

async function run(){
  const root = path.resolve(process.cwd());
  const src = path.join(root, 'public', 'vite.svg');
  const iconsDir = path.join(root, 'public', 'icons');
  const out192 = path.join(iconsDir, 'icon-192.png');
  const out512 = path.join(iconsDir, 'icon-512.png');
  const outApple = path.join(root, 'public', 'apple-touch-icon.png');

  await ensureDir(iconsDir);

  try {
    const svgBuffer = await fs.promises.readFile(src);
    await sharp(svgBuffer).resize(192, 192).png().toFile(out192);
    await sharp(svgBuffer).resize(512, 512).png().toFile(out512);
    await sharp(svgBuffer).resize(180, 180).png().toFile(outApple);
    console.log('Icons generated at:', out192, out512, outApple);
  } catch (e) {
    console.error('Failed to generate icons:', e);
    process.exit(1);
  }
}

run();




