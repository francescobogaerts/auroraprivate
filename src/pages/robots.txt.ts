import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
export const GET: APIRoute = () =>
  new Response(
    SITE.indexable
      ? `User-agent: *\nAllow: /\nDisallow: /intern/\nDisallow: /api/\n\nSitemap: ${SITE.url}/sitemap-index.xml\n`
      : `# Preview: not indexed until launch (PUBLIC_INDEXABLE=true)\nUser-agent: *\nDisallow: /\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
