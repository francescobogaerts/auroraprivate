// Fails the build if any redirect could match its own destination (redirect loop).
import fs from 'node:fs';
const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const toRe = (s) => new RegExp('^' + s.replace(/\./g, '\\.').replace(/:(\w+)\(([^)]+)\)/g, '(?<$1>$2)').replace(/:(\w+)/g, '(?<$1>[^/]+?)') + '$');
let bad = 0;
for (const r of v.redirects || []) {
  const probe = r.destination.replace(/:loc/g, 'bonaire').replace(/:slug/g, 'lacbay');
  for (const s of v.redirects) if (toRe(s.source).test(probe)) { bad++; console.log('LOOP RISK', r.source, '->', r.destination, 'matched by', s.source); }
}
console.log(`redirects: ${v.redirects.length}, loop risks: ${bad}`); process.exit(bad ? 1 : 0);
