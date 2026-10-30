#!/usr/bin/env node
/* Downloads free-license food photos from Wikimedia Commons (Google-referenced)
   into assets/img/dishes/. Re-runnable: skips files that already exist.
   Uses node fetch + polite delays to avoid CDN rate limiting. */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'img', 'dishes');
fs.mkdirSync(OUT, { recursive: true });

const UA = 'TastifySiteBuilder/1.0 (local site build; contact: none)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TARGETS = [
  ['mandi-chicken', 'kabsa chicken rice'],
  ['mandi-mutton', 'mandi food rice meat'],
  ['mandi-veg', 'vegetable biryani rice'],
  ['chicken-biryani', 'hyderabadi chicken biryani'],
  ['mutton-biryani', 'mutton biryani'],
  ['veg-biryani', 'vegetable biryani'],
  ['egg-biryani', 'egg biryani'],
  ['fish-biryani', 'fish biryani'],
  ['prawns-biryani', 'prawn biryani'],
  ['chicken-65', 'chicken 65'],
  ['chicken-lollipop', 'chicken lollipop'],
  ['fry-piece-chicken', 'fried chicken'],
  ['chicken-wings', 'fried chicken wings'],
  ['gongura-chicken', 'chicken curry'],
  ['paneer-butter-masala', 'paneer butter masala'],
  ['kadai-paneer', 'kadai paneer'],
  ['palak-paneer', 'palak paneer'],
  ['paneer-tikka', 'paneer tikka'],
  ['paneer-manchurian', 'paneer manchurian'],
  ['butter-chicken', 'butter chicken'],
  ['chicken-curry', 'chicken curry'],
  ['mutton-curry', 'mutton curry'],
  ['egg-curry', 'egg curry'],
  ['egg-bhurji', 'egg bhurji'],
  ['chicken-keema', 'keema'],
  ['chilli-chicken', 'chilli chicken'],
  ['chicken-manchurian', 'chicken manchurian'],
  ['chicken-majestic', 'chicken fry'],
  ['drumsticks', 'fried chicken drumsticks'],
  ['fish-fry', 'fish fry'],
  ['apollo-fish', 'fish 65'],
  ['prawns-fry', 'prawn fry'],
  ['chicken-pakoda', 'chicken pakora'],
  ['kaju-curry', 'kaju katli'], // cashew visual fallback
  ['veg-kolhapuri', 'veg kolhapuri'],
  ['aloo-gobi', 'aloo gobi'],
  ['gobi-manchurian', 'gobi manchurian'],
  ['gobi-65', 'fried cauliflower'],
  ['veg-manchurian', 'vegetable manchurian'],
  ['veg-makhani', 'veg makhani'],
  ['jeera-rice', 'jeera rice'],
  ['curd-rice', 'curd rice'],
  ['tomato-rice', 'tomato rice'],
  ['gongura-rice', 'gongura'],
  ['veg-fried-rice', 'vegetable fried rice'],
  ['chicken-fried-rice', 'chicken fried rice'],
  ['schezwan-noodles', 'hakka noodles'],
  ['naan', 'naan bread'],
  ['garlic-naan', 'garlic naan'],
  ['rumali-roti', 'rumali roti'],
  ['tandoori-roti', 'tandoori roti'],
  ['paratha', 'paratha'],
  ['kulcha', 'kulcha bread'],
  ['tandoori-chicken', 'tandoori chicken'],
  ['thali', 'indian thali food'],
  ['mojito', 'mojito drink glass'],
  ['french-fries', 'french fries'],
];

async function getJson(url) {
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return await r.json();
      console.log('   http ' + r.status + ' (attempt ' + a + ')');
    } catch (e) { console.log('   net err (attempt ' + a + '): ' + e.message); }
    await sleep(2500 * a);
  }
  return null;
}

async function download(url, dest) {
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 8000) { fs.writeFileSync(dest, buf); return true; }
        console.log('   too small (' + buf.length + 'B)');
        return false;
      }
      console.log('   http ' + r.status + ' (attempt ' + a + ')');
    } catch (e) { console.log('   net err (attempt ' + a + '): ' + e.message); }
    await sleep(3000 * a);
  }
  return false;
}

(async () => {
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  for (const [file, query] of TARGETS) {
    const dest = path.join(OUT, file + '.jpg');
    if (fs.existsSync(dest) && fs.statSync(dest).size > 8000) { manifest[file] = true; continue; }
    const api = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
      '&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + query) +
      '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cmime%7Csize&iiurlwidth=900&format=json';
    const data = await getJson(api);
    let ok = false, used = '';
    const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];
    pages.sort((a, b) => (a.index || 99) - (b.index || 99));
    for (const p of pages) {
      const info = p.imageinfo && p.imageinfo[0];
      if (!info || info.mime !== 'image/jpeg' || (info.width || 0) < 500) continue;
      if (/map|logo|diagram|coat_of_arms|flag/i.test(p.title)) continue;
      ok = await download(info.thumburl || info.url, dest);
      if (ok) { used = p.title; break; }
    }
    manifest[file] = ok;
    console.log((ok ? 'OK   ' : 'FAIL ') + file + (ok ? '  <- ' + used : '  (' + query + ')'));
    await sleep(700); // be polite to the API
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const got = Object.values(manifest).filter(Boolean).length;
  console.log('\nDone: ' + got + '/' + TARGETS.length + ' images available.');
})();
