import React, { useEffect } from 'react';
import { CssBaseline } from '@mui/material';
import Router from './router';
import Seo from '@/seo/Seo';
import { setupIdlePreloading, setupPreloadObserver } from '@/utils/preloadComponents';
import { ChartProvider } from '@/contexts/ChartContext';
import ServiceWorkerUpdatePrompt from '@/components/ServiceWorkerUpdatePrompt';
import { initializeGA, eventTracker } from '@/utils/analytics';

function App() {
  useEffect(() => {
    // Google Analytics 초기화 (프로덕션 환경에서만)
    if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_GA_MEASUREMENT_ID) {
      initializeGA(process.env.REACT_APP_GA_MEASUREMENT_ID);
    }
    
    // 이벤트 추적 시스템 초기화 - 사용자 동의 필요
    // 실제 프로덕션에서는 쿠키 동의 UI를 통해 설정
    eventTracker.setPrivacySettings({
      consentGiven: true, // 개발/테스트 환경에서는 기본 활성화
      anonymizeIp: true,
      excludePII: true,
    });
    
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
