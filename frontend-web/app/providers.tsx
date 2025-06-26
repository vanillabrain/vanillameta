'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// 기존 Context Providers import
// import { AuthProvider } from '../src/contexts/AuthContext';
// import { AlertProvider } from '../src/contexts/AlertContext';
// import { LoadingProvider } from '../src/contexts/LoadingContext';
// import { LayoutProvider } from '../src/contexts/LayoutContext';
// import { PerformanceProvider } from '../src/contexts/PerformanceContext';
// import { ChartProvider } from '../src/contexts/ChartContext';
// import { ErrorProvider } from '../src/contexts/ErrorContext';

// React Query Client 생성
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5분
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* 기존 Provider들을 점진적으로 추가 */}
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}