import React, { useEffect } from 'react';
import { CssBaseline } from '@mui/material';
import Router from './router';
import 'tui-grid/dist/tui-grid.css';
import Grid from 'tui-grid';
import Seo from '@/seo/Seo';
import { setupIdlePreloading, setupPreloadObserver } from '@/utils/preloadComponents';
import { ChartProvider } from '@/contexts/ChartContext';
import ServiceWorkerUpdatePrompt from '@/components/ServiceWorkerUpdatePrompt';
import { initializeGA } from '@/utils/analytics';

Grid.applyTheme('default', {
  outline: {
    border: '#63778a',
  },
  row: {
    hover: {
      background: '#E8F1FF',
    },
  },
  selection: {
    background: '#3AABFD',
  },
  area: {
    header: {
      background: '#fff',
    },
    body: {
      background: '#fff',
    },
  },
  cell: {
    normal: {
      background: 'rgba(0, 0, 0, 0)',
      border: '#D9DFE6',
      showVerticalBorder: true,
      showHorizontalBorder: true,
    },
    header: {
      background: '#fff',
      text: '#63778A',
      border: '#D9DFE6',
    },
    selectedHeader: {
      background: '#DBF1FC',
    },
    currentRow: {
      background: '#EBF9FF',
    },
  },
  scrollbar: {
    emptySpace: '#F2F4F7',
  },
});
Grid.setLanguage('ko', {
  // set new language
  display: {
    noData: '조회된 데이터가 없습니다.',
  },
});

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
