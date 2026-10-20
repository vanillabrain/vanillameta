import React, { lazy, Suspense, useMemo } from 'react';
import { Box, Skeleton } from '@mui/material';

const icons = import.meta.glob<{ default: React.ComponentType<{ style?: React.CSSProperties }> }>(
  '/src/assets/images/**/*.svg',
  { query: '?react' },
);

interface LazyIconProps {
  iconName: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
  width?: string | number;
  height?: string | number;
}

/**
 * LazyIcon 컴포넌트
 *
 * SVG 아이콘을 동적으로 로드하여 초기 번들 크기를 줄입니다.
 * 템플릿 아이콘과 일반 아이콘을 lazy loading으로 처리합니다.
 *
 * @param iconName - 아이콘 이름 (예: 'template01', 'ic-check')
 * @param style - 추가 스타일
 * @param fallback - 로딩 중 표시할 fallback 컴포넌트
 * @param width - 아이콘 너비
 * @param height - 아이콘 높이
 */
const LazyIcon: React.FC<LazyIconProps> = ({ iconName, style, fallback, width = '100%', height = '100%' }) => {
  // Vite's SVG plugin exports the React component as the default of ?react.
  const IconComponent = useMemo(() => {
    const folder = iconName.startsWith('template')
      ? 'template/'
      : iconName.startsWith('ic-') || iconName.includes('icon')
      ? 'icon/'
      : '';
    const loader = icons[`/src/assets/images/${folder}${iconName}.svg`];
    return loader ? lazy(loader) : null;
  }, [iconName]);

  const defaultFallback = (
    <Skeleton variant="rectangular" width={width} height={height} sx={{ backgroundColor: '#f5f5f5' }} />
  );

  if (!IconComponent) {
    return <>{fallback || defaultFallback}</>;
  }

  return (
    <Box sx={{ width, height, display: 'inline-block', ...style }}>
      <Suspense fallback={fallback || defaultFallback}>
        <IconComponent style={{ width: '100%', height: '100%' }} />
      </Suspense>
    </Box>
  );
};

export default LazyIcon;
