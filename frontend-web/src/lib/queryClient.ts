import { QueryClient } from '@tanstack/react-query';

/**
 * 앱 전역 서버 상태 클라이언트.
 * - retry 1회, 윈도우 포커스 시 자동 refetch 비활성, staleTime 30초
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
