import React, { Suspense, lazy } from 'react';
import { Loading } from '@/components/loading';

// ECharts 컴포넌트를 레이지 로드
const EChartsComponent = lazy(() => 
  import(/* webpackChunkName: "echarts-component" */ 'echarts-for-react')
);

interface LazyChartProps {
  option: any;
  style?: React.CSSProperties;
  className?: string;
  theme?: string;
  opts?: any;
  onEvents?: any;
  loading?: boolean;
}

// 차트 로딩 중 표시할 스켈레톤
const ChartSkeleton = ({ style, className }: { style?: React.CSSProperties; className?: string }) => (
  <div style={style} className={className}>
    <Loading in={true} style={{ opacity: 0.4 }} />
  </div>
);

// ECharts를 레이지 로드하는 래퍼 컴포넌트
export const LazyChart: React.FC<LazyChartProps> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton style={props.style} className={props.className} />}>
      <EChartsComponent {...props} />
    </Suspense>
  );
};

export default LazyChart;