import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackNavigation } from '@/utils/analytics';

export const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // 페이지 네비게이션 추적
    trackNavigation.pageView(location.pathname);
  }, [location.pathname]);

  return null;
};