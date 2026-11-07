// Verifies every internal link, image, srcset entry and anchor in the built site resolves.
import fs from 'node:fs'; import path from 'node:path'; import * as cheerio from 'cheerio';
const ROOT = fs.existsSync('.vercel/output/static') ? '.vercel/output/static' : 'dist/client';
const files = []; (function walk(d){ for (const f of fs.readdirSync(d)) { const p = path.join(d,f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } })(ROOT);
const resolve = (u) => { let p = decodeURI(u.split('#')[0].split('?')[0]); if (p === '/' ) p = '/index'; const c = [p, p + '.html', path.join(p,'index.html')]; return c.find((x) => fs.existsSync(path.join(ROOT, x)) && fs.statSync(path.join(ROOT,x)).isFile()); };
let bad = 0; const ids = {};
for (const f of files) { const $ = cheerio.load(fs.readFileSync(f,'utf8')); ids[f] = new Set($('[id]').map((i,e)=>$(e).attr('id')).get()); }
for (const f of files) {
  const $ = cheerio.load(fs.readFileSync(f, 'utf8'));
  const urls = [];
  $('a[href],link[href],img[src],script[src],source[srcset],img[srcset]').each((i, e) => {
    const el = $(e); ['href','src'].forEach(a => el.attr(a) && urls.push(el.attr(a)));
    const ss = el.attr('srcset'); if (ss) ss.split(',').forEach(s => urls.push(s.trim().split(' ')[0]));
  });
  for (const u of urls) {
    if (/^(https?:|mailto:|tel:|data:)/.test(u)) continue;
    if (u.startsWith('#')) { if (u.length > 1 && !ids[f].has(u.slice(1))) { bad++; console.log('ANCHOR', f, u); } continue; }
    if (!u.startsWith('/')) { if (!f.includes('/intern/')) { bad++; console.log('RELATIVE', f, u); } continue; } // relative (intern pages) checked separately below
    if (u.startsWith('/api/')) continue;
    const r = resolve(u); if (!r) { bad++; console.log('MISSING', f, u); continue; }
    const h = u.split('#')[1]; if (h && r.endsWith('.html')) { const t = path.join(ROOT, r); if (ids[t] && !ids[t].has(h)) { bad++; console.log('ANCHOR', f, u); } }
  }
  if (f.includes('/intern/')) $('[src],[href]').each((i,e)=>{ const u=$(e).attr('src')||$(e).attr('href'); if(u && !/^(https?:|#|\/|data:|mailto:)/.test(u) && !fs.existsSync(path.join(path.dirname(f),u.split('#')[0]))){ bad++; console.log('MISSING', f, u);} });
}
console.log(`${files.length} pages checked, ${bad} problems`); process.exit(bad ? 1 : 0);
