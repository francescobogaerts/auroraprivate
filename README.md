# AURORA Private — productie-build v2.0

Astro 7 + Vercel. Alle 21 publieke pagina's zijn statisch voorgerenderd. Alleen `/api/intake` draait als functie.
Inhoud en look zijn 1-op-1 v1.3 "Eerste licht" (Programma 2.0). Er is niets herschreven, alleen technisch herbouwd.

## Live zetten (eenmalig, ±3 minuten)

```bash
npm install
npx vercel link        # kies team orch5 → bestaand project "aurora-private"
npx vercel --prod      # Vercel bouwt zelf (npm run build)
```

Beter voor de lange termijn: zet deze map in een GitHub-repo en koppel die in Vercel (Project → Settings → Git).
Dan geeft elke push een preview-URL en gaat elke merge naar `main` live.

## Wat er technisch veranderd is ten opzichte van v1.3

| | v1.3 (prototype) | v2.0 (dit) |
|---|---|---|
| Pagina's | 21 losse HTML-bestanden, header/footer 21× gekopieerd | Eén layout, componenten, excursies uit één JSON-bestand |
| Beelden | Originele JPG's (tot 290 kB), via JavaScript geladen | AVIF/WebP/JPG in 3–4 formaten per beeld, `srcset`, lazy, hero met prioriteit |
| URL's | `excursie-bonaire-lacbay.html` | `/bonaire/lacbay` (oude URL's redirecten 308) |
| SEO | `noindex`, OG-beeld wees naar een niet-bestaand bestand | canonical, OG + Twitter per pagina (21 eigen deelbeelden), JSON-LD, sitemap, robots |
| Beveiliging | geen | CSP, HSTS, X-Frame-Options, Referrer-Policy `no-referrer`, Permissions-Policy |
| Privacy | — | geen cookies, geen tracking, geen externe requests, `/privacy` (concept) |
| Formulier | alleen voorvertoning | voorvertoning **of** echt versturen (schakelaar), met validatie, honeypot en rate limit |
| Kwaliteit | — | `npm run build` faalt bij een kapotte link, beeld of anker |

Lighthouse (mobiel, gesimuleerd 4G): home Performance 98, excursiepagina 88 · Accessibility 96 · Best practices 100 · CLS 0.
SEO scoort laag zolang `noindex` aan staat, en dat is zo bedoeld.

## Schakelaars (Vercel → Settings → Environment Variables)

| Variabele | Doet | Standaard |
|---|---|---|
| `PUBLIC_SITE_URL` | canonieke domeinnaam, bijv. `https://aurora-private.com` | `https://aurora-private.vercel.app` |
| `PUBLIC_INDEXABLE` | `true` = Google mag indexeren (pas bij lancering) | uit |
| `PUBLIC_INTAKE_LIVE` | `true` = het formulier verstuurt echt | uit (voorvertoning) |
| `RESEND_API_KEY` | mailroute voor het intakeformulier (resend.com, EU-regio) | — |
| `INTAKE_TO` | ontvanger(s), komma-gescheiden | — |
| `INTAKE_FROM` | geverifieerde afzender, bijv. `intake@aurora-private.com` | — |

Het formulier gaat pas live als alle vier de intake-variabelen gezet zijn. Anders blijft het netjes in voorvertoning.
Na een wijziging opnieuw deployen (de `PUBLIC_*`-waarden worden bij de build ingebakken).

## Structuur

```
src/
  data/site.ts            locaties, instellingen
  data/excursions.json    16 excursies (tekst, beelden, praktische feiten)
  pages/index.astro       home
  pages/{bonaire,india,mauritius,marbella}.astro
  pages/[loc]/[slug].astro   template voor alle excursies
  pages/privacy.astro · 404.astro · robots.txt.ts · api/intake.ts
  components/             Photo (responsive), Header, Footer, Intake, Brand
  layouts/Base.astro      head/SEO/JSON-LD
  styles/aurora.css       design system (ongewijzigd + kleine aanvullingen)
  scripts/aurora.ts       Snel weg, manifest, sticky stacks, 14 dagen, excursievoorvertoning
  assets/                 bronbeelden (worden bij build geoptimaliseerd)
public/
  og/                     21 deelbeelden 1200×630 (`npm run og` om te vernieuwen)
  intern/                 pitch, brand book, stijlkit, social, review (noindex; /pitch en /review)
scripts/                  og.mjs · postbuild.mjs (headers/redirects) · check-links.mjs
tools/                    migratiescript v1.3 → v2.0 + de originele v1.3-bron
```

## Een excursie toevoegen
1. Drie staande beelden (2:3) in `src/assets/img/`.
2. Een blok in `src/data/excursions.json` (kopieer een bestaande).
3. De kaart op de locatiepagina toevoegen in `src/pages/<locatie>.astro`.
4. `npm run og` voor het deelbeeld, daarna `npm run build`.

## Pagina's
Home · 4 locaties · 16 excursies · /traject · /organisaties · /voor-naasten · /particulier-of-zakelijk · /vragen · /privacy · 404 · /intern/*

## Nog open (inhoud, niet techniek)
- India-excursies liggen 300–900 km uit elkaar (Jaipur, Varanasi, Agra, Rishikesh) maar staan als "middag/avond in het ritme". Dat is logistiek niet haalbaar vanuit één verblijf: kies een basis of maak er reisdagen van.
- De Zilveren Kruis-blog is vervangen door /particulier-of-zakelijk zonder verzekeraarsclaims; de oorspronkelijke claim kon niet opnieuw geverifieerd worden.
- Toelating/uitsluiting op /traject is concept (Programma 2.0): juridische en BIG-toets voor livegang.
- Beeldprompts voor alle beelden: Drive 08-CLAUDE-VISUAL-PROMPTS.md.
- 8 excursies tonen een sfeerbeeld van de bestemming. De eigen beelden liggen nog bij ChatGPT (opdracht 06 in de Drive-map).
- Kaarten van India en Marbella ontbreken. Die blokken worden automatisch weggelaten tot de SVG in `public/atlas/` staat.
- Contactadres, KvK-gegevens en reactietermijn: daarna `/privacy` definitief maken en `PUBLIC_INTAKE_LIVE` aanzetten.
- Domeinnaam koppelen, daarna `PUBLIC_SITE_URL` en `PUBLIC_INDEXABLE` zetten.
- `/intern/*` is niet geïndexeerd, maar wel openbaar bereikbaar. Wil je het afschermen, zet dan Vercel Deployment Protection aan of haal de map weg voor livegang.
