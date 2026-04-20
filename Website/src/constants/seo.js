const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://retiresahi.vercel.app').replace(/\/$/, '');
const BRAND_NAME = 'RetireSahi';
const DEFAULT_IMAGE = `${SITE_URL}/favicon.svg`;

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND_NAME,
  url: SITE_URL,
  logo: DEFAULT_IMAGE,
};

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: BRAND_NAME,
  url: SITE_URL,
  inLanguage: 'en-IN',
};

export const DEFAULT_SEO = {
  title: `${BRAND_NAME} | Retirement Planning & NPS Insights`,
  description:
    'RetireSahi helps you understand retirement readiness, NPS strategy, and tax-saving opportunities with practical guidance for Indian investors.',
  robots: 'index,follow',
  canonicalPath: '/',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  image: DEFAULT_IMAGE,
  structuredData: [ORGANIZATION_SCHEMA, WEBSITE_SCHEMA],
};

export const ROUTE_SEO = {
  '/': {
    title: `${BRAND_NAME} | Know Exactly Where Your Retirement Stands`,
    description:
      'Measure retirement readiness, understand your NPS trajectory, and plan tax-smart contributions with RetireSahi.',
    canonicalPath: '/',
    ogType: 'website',
    structuredData: [ORGANIZATION_SCHEMA, WEBSITE_SCHEMA],
  },
  '/learn': {
    title: `Learn Retirement Planning | ${BRAND_NAME}`,
    description:
      'Explore practical guides on retirement planning, NPS optimization, and long-term wealth strategy tailored for India.',
    canonicalPath: '/learn',
    ogType: 'article',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Retirement Learning Hub',
        url: `${SITE_URL}/learn`,
        inLanguage: 'en-IN',
        isPartOf: {
          '@type': 'WebSite',
          name: BRAND_NAME,
          url: SITE_URL,
        },
      },
    ],
  },
  '/methodology': {
    title: `Methodology | ${BRAND_NAME}`,
    description:
      'Review the assumptions, formulas, and calculation approach behind RetireSahi retirement projections and scoring.',
    canonicalPath: '/methodology',
    ogType: 'article',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: 'RetireSahi Methodology',
        url: `${SITE_URL}/methodology`,
        author: {
          '@type': 'Organization',
          name: BRAND_NAME,
        },
        publisher: {
          '@type': 'Organization',
          name: BRAND_NAME,
          logo: {
            '@type': 'ImageObject',
            url: DEFAULT_IMAGE,
          },
        },
      },
    ],
  },
  '/onboarding': {
    title: `Onboarding | ${BRAND_NAME}`,
    description: 'Secure onboarding area for your retirement profile setup.',
    canonicalPath: '/onboarding',
    robots: 'noindex,nofollow',
  },
  '/dashboard': {
    title: `Dashboard | ${BRAND_NAME}`,
    description: 'Private retirement dashboard with personalized insights.',
    canonicalPath: '/dashboard',
    robots: 'noindex,nofollow',
  },
  '/tax-shield': {
    title: `Tax Shield | ${BRAND_NAME}`,
    description: 'Private tax optimization dashboard for your profile.',
    canonicalPath: '/tax-shield',
    robots: 'noindex,nofollow',
  },
  '/dream-planner': {
    title: `Dream Planner | ${BRAND_NAME}`,
    description: 'Private lifestyle and retirement target planning tools.',
    canonicalPath: '/dream-planner',
    robots: 'noindex,nofollow',
  },
  '/ai-copilot': {
    title: `AI Copilot | ${BRAND_NAME}`,
    description: 'Private AI retirement copilot for personalized guidance.',
    canonicalPath: '/ai-copilot',
    robots: 'noindex,nofollow',
  },
  '/settings': {
    title: `Settings | ${BRAND_NAME}`,
    description: 'Private account and preferences settings.',
    canonicalPath: '/settings',
    robots: 'noindex,nofollow',
  },
};

function normalizePathname(pathname) {
  if (!pathname) return '/';
  if (pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function getSeoForPath(pathname) {
  const normalizedPath = normalizePathname(pathname);
  const routeSeo = ROUTE_SEO[normalizedPath] || DEFAULT_SEO;
  const canonicalPath = routeSeo.canonicalPath || normalizedPath;

  return {
    ...DEFAULT_SEO,
    ...routeSeo,
    canonical: `${SITE_URL}${canonicalPath}`,
    image: routeSeo.image || DEFAULT_IMAGE,
  };
}

export { SITE_URL, BRAND_NAME, DEFAULT_IMAGE };