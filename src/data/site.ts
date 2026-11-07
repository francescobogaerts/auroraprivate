// Single source of truth for site-wide settings.
// Environment overrides (Vercel → Settings → Environment Variables):
//   PUBLIC_SITE_URL      canonical origin, e.g. https://aurora-private.com
//   PUBLIC_INDEXABLE     "true" only at launch; until then every page is noindex
//   PUBLIC_INTAKE_LIVE   "true" once the contact route is confirmed (see /api/intake)

export const SITE = {
  name: 'AURORA Private',
  url: (import.meta.env.PUBLIC_SITE_URL || 'https://aurora-private.vercel.app').replace(/\/$/, ''),
  indexable: import.meta.env.PUBLIC_INDEXABLE === 'true',
  intakeLive: import.meta.env.PUBLIC_INTAKE_LIVE === 'true',
  lang: 'nl',
  locale: 'nl_NL',
  themeColor: '#1E2624',
  description:
    'Zes maanden persoonlijke begeleiding met veertien dagen op Bonaire, India, Mauritius of Marbella als keerpunt.',
};

export type LocKey = 'bonaire' | 'india' | 'mauritius' | 'marbella';

export const LOCATIONS: { key: LocKey; name: string; edition: string }[] = [
  { key: 'bonaire', name: 'Bonaire', edition: 'Editie 01' },
  { key: 'india', name: 'India', edition: 'Wachtlijst' },
  { key: 'mauritius', name: 'Mauritius', edition: 'Wachtlijst' },
  { key: 'marbella', name: 'Marbella', edition: 'Wachtlijst' },
];

export const locName = (k: string) => LOCATIONS.find((l) => l.key === k)?.name ?? k;
