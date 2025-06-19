import { createContext, FC, useEffect, useState, useCallback, useMemo } from 'react';
import { Loading } from '@/components/loading';

type LoadingProviderType = { loading: any; showLoading: () => void; hideLoading: () => void };

export const LoadingContext = createContext<LoadingProviderType>({} as LoadingProviderType);

export const LoadingProvider = ({ children }) => {
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
      <Loading in={loading} />
      {children}
    </LoadingContext.Provider>
  );
};
