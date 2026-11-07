// POST /api/intake — confidential first-conversation request.
// Design: forward once, store nothing, log nothing that identifies the sender.
// Off until PUBLIC_INTAKE_LIVE=true AND the mail route is configured:
//   RESEND_API_KEY  · INTAKE_TO (recipient)  · INTAKE_FROM (verified sender, e.g. intake@aurora-private.com)
import type { APIRoute } from 'astro';

export const prerender = false;

const LOCS = new Set(['bonaire', 'india', 'mauritius', 'marbella', 'open']);
const WHO = new Set(['mezelf', 'een naaste', 'mijn organisatie']);
const VIA = new Set(['Signal', 'telefoon', 'e-mail']);
const hits = new Map<string, number[]>(); // best-effort, per warm instance

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const clean = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const env = process.env;
  if (env.PUBLIC_INTAKE_LIVE !== 'true' || !env.RESEND_API_KEY || !env.INTAKE_TO || !env.INTAKE_FROM) {
    return json(503, { error: 'Het contactkanaal is nog niet open. Je vragen staan nog in het formulier.' });
  }
  const origin = request.headers.get('origin');
  const site = (env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (origin && site && origin !== site && !origin.endsWith('.vercel.app')) return json(403, { error: 'Niet toegestaan.' });

  // rate limit: 5 per 10 minutes per address (address is never logged or stored beyond this map)
  const now = Date.now(); const key = clientAddress || 'x';
  const list = (hits.get(key) || []).filter((t) => now - t < 600_000);
  if (list.length >= 5) return json(429, { error: 'Even geduld. Probeer het over een paar minuten opnieuw.' });
  list.push(now); hits.set(key, list);

  let form: FormData;
  try { form = await request.formData(); } catch { return json(400, { error: 'Ongeldig verzoek.' }); }
  if (clean(form.get('website'), 200)) return json(200, { ok: true }); // honeypot: pretend success

  const wie = clean(form.get('wie'), 40), loc = clean(form.get('loc'), 20), via = clean(form.get('via'), 20);
  const contact = clean(form.get('contact'), 120), vragen = clean(form.get('vragen'), 2000);
  if (!WHO.has(wie) || !LOCS.has(loc) || !VIA.has(via)) return json(400, { error: 'Controleer je keuzes.' });
  if (contact.length < 5) return json(400, { error: 'Vul in hoe we je kunnen bereiken.' });
  if (via === 'e-mail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return json(400, { error: 'Controleer je e-mailadres.' });

  const text = [
    'Nieuw verzoek voor een eerste gesprek (AURORA Private)', '',
    `Voor: ${wie}`, `Locatie: ${loc}`, `Contact via: ${via}`, `Bereikbaar op: ${contact}`, '',
    vragen ? `Vragen:\n${vragen}` : 'Geen vragen meegestuurd.', '',
    '— Dit bericht is niet opgeslagen op de website. Verwijder het na opvolging.',
  ].join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.INTAKE_FROM, to: env.INTAKE_TO.split(','), subject: 'Eerste gesprek · AURORA Private', text }),
  }).catch(() => null);

  if (!r || !r.ok) return json(502, { error: 'Versturen lukte niet. Probeer het later opnieuw.' });
  return json(200, { ok: true });
};

export const ALL: APIRoute = () => json(405, { error: 'Alleen POST.' });
