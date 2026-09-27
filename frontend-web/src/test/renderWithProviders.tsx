import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme/theme';
import { AlertProvider } from '@/contexts/AlertContext';
import { LoadingProvider } from '@/contexts/LoadingContext';

/**
 * 앱과 동일한 Provider 구성으로 테스트 대상을 렌더링한다.
 * (react-query 는 테스트에서 재시도하지 않도록 retry: false)
 */
export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[route]}>
          <ThemeProvider theme={theme}>
            <LoadingProvider>
              <AlertProvider>{ui}</AlertProvider>
            </LoadingProvider>
          </ThemeProvider>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}
