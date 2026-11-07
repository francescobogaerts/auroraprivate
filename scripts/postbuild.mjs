// Applies the security headers and legacy redirects from vercel.json to the Build Output API config.
// (When an adapter writes .vercel/output, Vercel routes from config.json, so we put them there explicitly.)
import fs from 'node:fs';
const cfgPath = '.vercel/output/config.json';
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const toRe = (s) => '^' + s
  .replace(/\./g, '\\.')
  .replace(/:(\w+)\(([^)]+)\)/g, '(?<$1>$2)')
  .replace(/:(\w+)/g, '(?<$1>[^/]+?)')
  .replace(/\(\\\.\*\)|\(\.\*\)/g, '(.*)') + '$';
const sub = (d) => d.replace(/:(\w+)/g, '$$$1');
const redirects = (v.redirects || []).map((r) => ({
  src: toRe(r.source), headers: { Location: sub(r.destination) }, status: r.permanent ? 308 : 307,
}));
const headers = (v.headers || []).map((h) => ({
  src: toRe(h.source), headers: Object.fromEntries(h.headers.map((x) => [x.key, x.value])), continue: true,
}));
const ours = new Set([...headers, ...redirects].map((r) => r.src + (r.status || '')));
cfg.routes = cfg.routes.filter((r) => !(r.src && ours.has(r.src + (r.status || '')) && (r.continue || r.status)));
cfg.routes.unshift(...headers.map((r) => ({ ...r })), ...redirects);
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log(`postbuild: ${headers.length} header rules, ${redirects.length} redirects merged`);
