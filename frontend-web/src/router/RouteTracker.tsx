import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackNavigation } from '@/utils/analytics';

export const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // 페이지 네비게이션 추적
    const page = location.pathname
      .replace(/\/(share|embed|published|reuse)\/[^/]+(?:\/[^/]+)?/g, '/$1/:reference')
      .replace(/\/\d+(?=\/|$)/g, '/:id');
    trackNavigation.pageView(page);
  }, [location.pathname]);

  return null;
};
