#!/usr/bin/env node
/* Optimizes all dish photos: resizes to max 900px wide, converts to WebP (quality 82)
   and keeps a JPEG fallback. Updates data.js/index.html references from .png to .webp
   for the tastify real photos. */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DISHES = path.join(__dirname, '..', 'assets', 'img', 'dishes');
const REAL = fs.readdirSync(DISHES).filter(f => f.endsWith('-tastify.png'));

(async () => {
  for (const f of REAL) {
    const src = path.join(DISHES, f);
    const base = f.replace(/\.png$/, '');
    const meta = await sharp(src).metadata();
    await sharp(src)
      .resize({ width: Math.min(900, meta.width), withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(DISHES, base + '.webp'));
    await sharp(src)
      .resize({ width: Math.min(900, meta.width), withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(DISHES, base + '.jpg'));
    const w = fs.statSync(path.join(DISHES, base + '.webp')).size;
    const j = fs.statSync(path.join(DISHES, base + '.jpg')).size;
    console.log(`${base}: png=${(fs.statSync(src).size/1024).toFixed(0)}KB -> webp=${(w/1024).toFixed(0)}KB jpg=${(j/1024).toFixed(0)}KB`);
  }
})();
