import { createContext, FC, useEffect, useState } from 'react';
import { Loading } from '@/components/loading';

type LoadingProviderType = { loading: any; showLoading: () => void; hideLoading: () => void };

export const LoadingContext = createContext<LoadingProviderType>({} as LoadingProviderType);

export const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => setLoading(false);
  }, []);

  const showLoading = () => {
    setLoading(true);
  };

  const hideLoading = () => {
    setLoading(false);
  };

  return (
    <LoadingContext.Provider value={{ loading, showLoading, hideLoading }}>
      <Loading in={loading} />
      {children}
    </LoadingContext.Provider>
  );
};
