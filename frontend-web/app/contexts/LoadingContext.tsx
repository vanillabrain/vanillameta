'use client';

import { createContext, useEffect, useState, useCallback, useMemo, useContext, ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';

interface LoadingContextType {
  loading: boolean;
  showLoading: () => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider = ({ children }: LoadingProviderProps) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => setLoading(false);
  }, []);

  // 메모이제이션된 핸들러 함수들
  const showLoading = useCallback(() => {
    setLoading(true);
  }, []);

  const hideLoading = useCallback(() => {
    setLoading(false);
  }, []);

  // Context value 메모이제이션으로 불필요한 리렌더링 방지
  const contextValue = useMemo(
    () => ({
      loading,
      showLoading,
      hideLoading,
    }),
    [loading, showLoading, hideLoading],
  );

  return (
    <LoadingContext.Provider value={contextValue}>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      )}
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

// Backward compatibility
export { LoadingContext };