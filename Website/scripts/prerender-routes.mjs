import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = (process.env.VITE_SITE_URL || 'https://retiresahi.vercel.app').replace(/\/$/, '');
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const DEFAULT_IMAGE = `${SITE_URL}/favicon.svg`;

const ROUTE_META = {
  '/learn': {
    title: 'Learn Retirement Planning | RetireSahi',
    description:
      'Explore practical guides on retirement planning, NPS optimization, and long-term wealth strategy tailored for India.',
    canonical: `${SITE_URL}/learn`,
    ogType: 'article',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Retirement Learning Hub',
      url: `${SITE_URL}/learn`,
      inLanguage: 'en-IN',
      isPartOf: {
        '@type': 'WebSite',
        name: 'RetireSahi',
        url: SITE_URL,
      },
    },
  },
  '/methodology': {
    title: 'Methodology | RetireSahi',
    description:
      'Review the assumptions, formulas, and calculation approach behind RetireSahi retirement projections and scoring.',
    canonical: `${SITE_URL}/methodology`,
    ogType: 'article',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'RetireSahi Methodology',
      url: `${SITE_URL}/methodology`,
      author: {
        '@type': 'Organization',
        name: 'RetireSahi',
      },
      publisher: {
        '@type': 'Organization',
        name: 'RetireSahi',
        logo: {
          '@type': 'ImageObject',
          url: DEFAULT_IMAGE,
        },
      },
    },
  },
};

function stripSeoTags(html) {
  let output = html;

  const patterns = [
    /<title>[\s\S]*?<\/title>/gi,
    /<meta\s+name="description"[^>]*>\s*/gi,
    /<meta\s+name="robots"[^>]*>\s*/gi,
    /<link\s+rel="canonical"[^>]*>\s*/gi,
    /<meta\s+property="og:[^"]+"[^>]*>\s*/gi,
    /<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi,
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi,
  ];

  for (const pattern of patterns) {
    output = output.replace(pattern, '');
  }

  return output;
}

function buildSeoBlock(meta) {
  return [
    `    <title>${meta.title}</title>`,
    `    <meta name="description" content="${meta.description}" />`,
    '    <meta name="robots" content="index,follow" />',
    `    <link rel="canonical" href="${meta.canonical}" />`,
    '',
    '    <meta property="og:site_name" content="RetireSahi" />',
    '    <meta property="og:locale" content="en_IN" />',
    `    <meta property="og:type" content="${meta.ogType}" />`,
    `    <meta property="og:title" content="${meta.title}" />`,
    `    <meta property="og:description" content="${meta.description}" />`,
    `    <meta property="og:url" content="${meta.canonical}" />`,
    `    <meta property="og:image" content="${DEFAULT_IMAGE}" />`,
    '',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${meta.title}" />`,
    `    <meta name="twitter:description" content="${meta.description}" />`,
    `    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />`,
    '',
    `    <script type="application/ld+json">${JSON.stringify(meta.structuredData)}</script>`,
    '',
  ].join('\n');
}

function ensureRouteHtml(route, htmlTemplate) {
  const routeMeta = ROUTE_META[route];
  if (!routeMeta) return;

  const cleanedHtml = stripSeoTags(htmlTemplate);
  const seoBlock = buildSeoBlock(routeMeta);
  const routeHtml = cleanedHtml.replace('</head>', `${seoBlock}  </head>`);

  const routeDir = path.join(DIST_DIR, route.replace(/^\//, ''));
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), routeHtml, 'utf8');
}

if (!fs.existsSync(INDEX_HTML_PATH)) {
  console.error('prerender-routes: dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

for (const route of Object.keys(ROUTE_META)) {
  ensureRouteHtml(route, baseHtml);
}

console.log('prerender-routes: generated static HTML for /learn and /methodology');
