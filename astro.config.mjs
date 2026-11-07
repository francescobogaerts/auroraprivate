// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

const site = (process.env.PUBLIC_SITE_URL || 'https://aurora-private.vercel.app').replace(/\/$/, '');

export default defineConfig({
  site,
  output: 'static',             // every page is prerendered; only /api/intake runs as a function
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  adapter: vercel({ imageService: false, webAnalytics: { enabled: false } }),
  integrations: [sitemap({ filter: (p) => !p.includes('/intern') && !p.endsWith('/404') })],
  image: { responsiveStyles: false },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
