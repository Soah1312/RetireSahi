import { useEffect, useState } from 'react';

export default function DeferredAnalytics() {
  const [AnalyticsComponent, setAnalyticsComponent] = useState(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let isMounted = true;

    import('@vercel/analytics/react').then((mod) => {
      if (isMounted) {
        setAnalyticsComponent(() => mod.Analytics);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!AnalyticsComponent) return null;

  return <AnalyticsComponent />;
}
