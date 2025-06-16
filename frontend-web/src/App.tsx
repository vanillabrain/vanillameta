import React, { useEffect } from 'react';
import { CssBaseline } from '@mui/material';
import Router from './router';
import Seo from '@/seo/Seo';
import { setupIdlePreloading, setupPreloadObserver } from '@/utils/preloadComponents';
import { ChartProvider } from '@/contexts/ChartContext';
import ServiceWorkerUpdatePrompt from '@/components/ServiceWorkerUpdatePrompt';
import { initializeGA } from '@/utils/analytics';

function App() {
  useEffect(() => {
    // Google Analytics 초기화 (프로덕션 환경에서만)
    if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_GA_MEASUREMENT_ID) {
      initializeGA(process.env.REACT_APP_GA_MEASUREMENT_ID);
    }
    
    // Setup idle preloading after the main app has loaded
    setupIdlePreloading();
    
    // Setup intersection observer for link-based preloading
    const observer = setupPreloadObserver();
    
    // Cleanup observer on unmount
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <>
      <Seo />
      <CssBaseline />
      <ChartProvider>
        <Router />
      </ChartProvider>
      <ServiceWorkerUpdatePrompt />
    </>
  );
}

export default App;
