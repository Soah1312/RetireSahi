import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { BRAND_NAME, getSeoForPath } from '../constants/seo';

export default function SeoHead() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en" />
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="robots" content={seo.robots} />
      <link rel="canonical" href={seo.canonical} />

      <meta property="og:site_name" content={BRAND_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:type" content={seo.ogType} />
      <meta property="og:title" content={seo.ogTitle || seo.title} />
      <meta property="og:description" content={seo.ogDescription || seo.description} />
      <meta property="og:url" content={seo.canonical} />
      <meta property="og:image" content={seo.image} />

      <meta name="twitter:card" content={seo.twitterCard} />
      <meta name="twitter:title" content={seo.twitterTitle || seo.title} />
      <meta name="twitter:description" content={seo.twitterDescription || seo.description} />
      <meta name="twitter:image" content={seo.image} />

      {(seo.structuredData || []).map((item, index) => (
        <script key={`ld-json-${location.pathname}-${index}`} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}