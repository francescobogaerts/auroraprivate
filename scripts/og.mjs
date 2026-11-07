// Generates 1200×630 social preview images into public/og/ (committed; run `npm run og` after changing photos).
// Needs the Jost font installed locally for the title (see README).
import fs from 'node:fs';
import sharp from 'sharp';

const ex = JSON.parse(fs.readFileSync('src/data/excursions.json', 'utf8'));
const LOC = { bonaire: 'Bonaire', india: 'India', mauritius: 'Mauritius', marbella: 'Marbella' };
const jobs = [
  { out: 'home', photo: 'photography/aurora-red-sea', title: 'Zes maanden begeleiding.', sub: 'Veertien dagen keerpunt.' },
  ...Object.entries(LOC).map(([k, n]) => ({ out: k, photo: `photography/aurora-red-${k}`, title: n, sub: k === 'bonaire' ? 'Editie 01 · veertien dagen op locatie' : 'Veertien dagen op locatie · wachtlijst' })),
  { out: 'traject', photo: 'photography/aurora-red-room', title: 'Het traject', sub: '4 weken · 14 dagen · 5 maanden' },
  { out: 'organisaties', photo: 'img/marbella-patio', title: 'Voor organisaties', sub: '14 dagen afwezig · 6 maanden begeleiding' },
  { out: 'naasten', photo: 'img/india-courtyard', title: 'Voor naasten', sub: 'Het gesprek beginnen' },
  { out: 'betalen', photo: 'img/marbella-garden', title: 'Particulier of zakelijk', sub: '€17.500 · het volledige traject' },
  ...ex.map((e) => ({ out: `${e.loc}-${e.slug}`, photo: e.beats[0].photo, title: e.title, sub: `Excursie · ${LOC[e.loc]}` })),
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.mkdirSync('public/og', { recursive: true });

for (const j of jobs) {
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#1E2624" stop-opacity="0"/><stop offset="1" stop-color="#1E2624" stop-opacity=".82"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(64,56) scale(1.1)" fill="none" stroke="#ECEEEA" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 39 L24 8 L42 39 M8 32 H40 M13 32 A11 11 0 0 1 35 32"/></g>
  <text x="130" y="96" fill="#ECEEEA" font-family="Jost" font-weight="400" font-size="26" letter-spacing="7">AURORA</text>
  <text x="131" y="120" fill="#ECEEEA" font-family="Jost" font-weight="400" font-size="12" letter-spacing="6" opacity=".8">PRIVATE</text>
  <text x="64" y="520" fill="#ECEEEA" font-family="Jost" font-weight="300" font-size="64">${esc(j.title)}</text>
  <text x="66" y="570" fill="#D8BBA6" font-family="Jost" font-weight="400" font-size="24" letter-spacing="2">${esc(j.sub)}</text>
  <rect x="64" y="590" width="56" height="2" fill="#97555C"/>
</svg>`);
  await sharp(`src/assets/${j.photo}.jpg`).resize(1200, 630, { fit: 'cover', position: 'attention' })
    .composite([{ input: overlay }]).jpeg({ quality: 78, mozjpeg: true }).toFile(`public/og/${j.out}.jpg`);
}
await sharp('public/brand/favicon.svg', { density: 600 }).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('og images:', jobs.length);
