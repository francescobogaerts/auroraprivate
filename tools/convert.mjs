// One-off migration: v1.3 static HTML (tools/legacy/source-v1.3) → Astro pages + excursion data.
// Kept in the repo so the migration is reproducible; not part of the build.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const SRC = 'tools/legacy/source-v1.3';
const LOCS = ['bonaire', 'india', 'mauritius', 'marbella'];
const PUB = 'public';

const photoKey = (fig) => {
  const ds = fig.attr('data-src'); const dp = fig.attr('data-photo');
  if (ds) return ds.replace(/^assets\//, '').replace(/\.jpg$/, '');
  if (dp) return 'photography/' + dp;
  return null;
};

export function rewriteHref(h, here) {
  if (!h) return h;
  if (/^(https?:|mailto:|tel:)/.test(h)) return h;
  const [file, hash] = h.split('#');
  if (!file) return h; // in-page anchor
  let p;
  if (file === 'home.html' || file === 'index.html') p = '/';
  else if (LOCS.includes(file.replace('.html', ''))) p = '/' + file.replace('.html', '');
  else {
    const m = file.match(/^excursie-([a-z]+)-(.+)\.html$/);
    if (m) p = `/${m[1]}/${m[2]}`;
    else p = '/' + file;
  }
  if (hash && p === here) return '#' + hash;
  return hash ? `${p}#${hash}` : p;
}

function convertMain(file, here, loc) {
  const $ = cheerio.load(fs.readFileSync(path.join(SRC, file), 'utf8'), { decodeEntities: false });
  const main = $('main');
  main.find('a[href]').each((_, a) => { $(a).attr('href', rewriteHref($(a).attr('href'), here)); });

  // atlas maps: point at /atlas, drop the ones that don't exist yet (no 404s, no JS fallback)
  main.find('figure.atlas').each((_, f) => {
    const img = $(f).find('img');
    const name = path.basename(img.attr('src') || '');
    if (!fs.existsSync(path.join(PUB, 'atlas', name))) $(f).remove();
    else img.attr('src', '/atlas/' + name).attr('loading', 'lazy').attr('decoding', 'async');
  });

  main.find('img[src^="assets/"]').each((_, i) => { $(i).attr('src', '/' + $(i).attr('src').replace(/^assets\//, '')); });
  if (main.find('[src^="assets/"],[href^="assets/"],[style*="assets/"]').length) console.warn('relative asset left in', file);

  const comps = [];
  let firstPhoto = true;
  main.find('.seats[aria-label]').attr('role', 'img');
  main.find('figure.photo').each((_, el) => {
    const f = $(el); const key = photoKey(f);
    if (!key) return;
    const img = f.find('img');
    const cls = (f.attr('class') || '').replace(/\bphoto\b/, '').trim();
    const style = f.attr('style');
    f.find('img, .pending-note').remove();
    const inner = f.html().trim();
    const pr = firstPhoto && img.attr('loading') === 'eager';
    firstPhoto = false;
    const attrs = [`src=${JSON.stringify(key)}`, `alt={${JSON.stringify(img.attr('alt') || '')}}`];
    if (cls) attrs.push(`class=${JSON.stringify(cls)}`);
    if (style) attrs.push(`style=${JSON.stringify(style)}`);
    if (pr) attrs.push('priority');
    comps.push(inner ? `<Photo ${attrs.join(' ')}>${inner}</Photo>` : `<Photo ${attrs.join(' ')} />`);
    f.replaceWith(`<x-comp data-i="${comps.length - 1}"></x-comp>`);
  });

  main.find('.vault').each((_, v) => {
    comps.push(`<Intake loc=${JSON.stringify(loc)} />`);
    $(v).replaceWith(`<x-comp data-i="${comps.length - 1}"></x-comp>`);
  });

  main.find('script[type="application/json"]').each((_, s) => {
    const id = $(s).attr('id'); const json = $(s).html();
    comps.push(`<script type="application/json" id=${JSON.stringify(id)} is:inline set:html={${JSON.stringify(json)}} />`);
    $(s).replaceWith(`<x-comp data-i="${comps.length - 1}"></x-comp>`);
  });

  let html = main.html();
  html = html.replace(/<x-comp data-i="(\d+)"><\/x-comp>/g, (_, i) => comps[+i]);
  if (/[{}]/.test(html.replace(/\{[^{}]*\}/g, ''))) console.warn('brace check', file);
  return { html, title: $('title').text(), desc: $('meta[name=description]').attr('content') };
}

function page({ html, title, desc }, { current, og, crumbs, talk }) {
  return `---
// Generated from ${'v1.3'} by tools/convert.mjs, then owned by this repo. Edit freely.
import Base from '../layouts/Base.astro';
import Photo from '../components/Photo.astro';
import Intake from '../components/Intake.astro';
---
<Base title=${JSON.stringify(title)} description=${JSON.stringify(desc)} current=${JSON.stringify(current)} og=${JSON.stringify(og)}${crumbs ? ` crumbs={${JSON.stringify(crumbs)}}` : ''}${talk ? ` talk=${JSON.stringify(talk)}` : ''}>
${html.trim()}
</Base>
`;
}

// Home + locations
const home = convertMain('home.html', '/', 'bonaire');
fs.writeFileSync('src/pages/index.astro', page(home, { current: 'home', og: 'home' }));
for (const l of LOCS) {
  const c = convertMain(`${l}.html`, '/' + l, l);
  const name = l[0].toUpperCase() + l.slice(1);
  fs.writeFileSync(`src/pages/${l}.astro`, page(c, { current: l, og: l, crumbs: [{ name, path: '/' + l }] }));
}

// Excursions → structured data
const out = [];
for (const f of fs.readdirSync(SRC).filter((f) => f.startsWith('excursie-'))) {
  const $ = cheerio.load(fs.readFileSync(path.join(SRC, f), 'utf8'), { decodeEntities: false });
  const [, loc, slug] = f.match(/^excursie-([a-z]+)-(.+)\.html$/);
  const rib = $('.ribbon span');
  const beats = $('.story .beat').map((i, b) => {
    const B = $(b); const fig = B.find('figure.photo');
    return {
      photo: photoKey(fig), alt: fig.find('img').attr('alt') || '',
      eyebrow: B.find('.eyebrow').text() || undefined,
      label: B.find('.k').text() || undefined,
      line: B.find('.line').text(),
    };
  }).get();
  const facts = $('dl.facts > div').map((i, d) => ({ dt: $(d).find('dt').text(), dd: $(d).find('dd').text() })).get();
  // card info as shown on the location page
  const $l = cheerio.load(fs.readFileSync(path.join(SRC, `${loc}.html`), 'utf8'), { decodeEntities: false });
  const card = $l(`a.exc[href="${f}"]`);
  out.push({
    loc, slug,
    order: Number((rib.eq(2).text().match(/(\d+) van/) || [])[1] || 0),
    title: $('h1').first().text(),
    metaTitle: $('title').text(),
    description: $('meta[name=description]').attr('content'),
    when: rib.eq(1).text(),
    card: {
      when: card.find('.when').text(),
      text: card.find('p').first().text(),
      teaser: card.attr('data-teaser') || '',
      photo: photoKey(card.find('figure.photo')) || beats[0].photo,
    },
    beats,
    practical: {
      heading: $('#praktisch-t').text(),
      lead: $('section[aria-labelledby="praktisch-t"] .lead').first().text(),
      body: $('section[aria-labelledby="praktisch-t"] p.soft').first().text(),
    },
    facts,
    credit: $('section[aria-labelledby="praktisch-t"] .credit').text(),
  });
}
out.sort((a, b) => LOCS.indexOf(a.loc) - LOCS.indexOf(b.loc) || a.order - b.order);
fs.writeFileSync('src/data/excursions.json', JSON.stringify(out, null, 2));
console.log('pages: 5, excursions:', out.length);
