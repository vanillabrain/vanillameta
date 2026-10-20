import React from 'react';
import { connectSocket } from '@/helpers/socket';
import Router from './router';
import Seo from '@/seo/Seo';
import { initializeGA } from '@/utils/analytics';
import { ChartProvider } from '@/contexts/ChartContext';
import ServiceWorkerUpdatePrompt from '@/components/ServiceWorkerUpdatePrompt';
import { setupIdlePreloading, setupPreloadObserver } from '@/utils/preloadComponents';

function App() {
  React.useEffect(() => {
    connectSocket();
    if (import.meta.env.PROD && import.meta.env.REACT_APP_GA_MEASUREMENT_ID) {
      initializeGA(import.meta.env.REACT_APP_GA_MEASUREMENT_ID);
    }
    setupIdlePreloading();
    const observer = setupPreloadObserver();
    return () => observer?.disconnect();
  }, []);
  return (
    <>
      <Seo />
      <ChartProvider>
        <Router />
      </ChartProvider>
      <ServiceWorkerUpdatePrompt />
    </>
  );
}

export default App;
