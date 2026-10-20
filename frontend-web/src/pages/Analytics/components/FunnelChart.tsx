import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { FunnelStep } from '../types';

interface Props {
  funnel: FunnelStep[];
}

const FunnelChart: React.FC<Props> = ({ funnel }) => {
  const chartOption = useMemo(() => {
    const data = funnel.map((step, index) => ({
      name: formatStepName(step.step),
      value: step.users,
      label: {
        show: true,
        position: 'inside',
        formatter: (params: any) => {
          const currentStep = funnel.find(s => formatStepName(s.step) === params.name);
          return `${params.name}\n${params.value}명\n(${currentStep?.conversionRate.toFixed(1)}%)`;
        },
        fontSize: 14,
        fontWeight: 'bold',
      },
      itemStyle: {
        color: getStepColor(index, funnel.length),
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const step = funnel.find(s => formatStepName(s.step) === params.name);
          if (!step) return '';

          return `
            <div style="padding: 8px;">
              <strong>${params.name}</strong><br/>
              사용자 수: ${params.value.toLocaleString()}명<br/>
              전환율: ${step.conversionRate.toFixed(1)}%<br/>
              이탈률: ${step.dropOffRate.toFixed(1)}%
            </div>
          `;
        },
      },
      series: [
        {
          name: '전환 퍼널',
          type: 'funnel',
          left: '10%',
          top: 60,
          bottom: 60,
          width: '80%',
          min: 0,
          max: funnel[0]?.users || 100,
          minSize: '20%',
          maxSize: '100%',
          sort: 'none',
          gap: 2,
          data,
        },
      ],
    };
  }, [funnel]);

  const formatStepName = (step: string): string => {
    const nameMap: Record<string, string> = {
      user_login: '로그인',
      dashboard_viewed: '대시보드 조회',
      widget_created: '위젯 생성',
      dashboard_created: '대시보드 생성',
      dataset_created: '데이터셋 생성',
    };
    return nameMap[step] || step;
  };

  const getStepColor = (index: number, total: number): string => {
    const colors = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c2185b'];
    return colors[index % colors.length];
  };

  return (
    <Box sx={{ height: 400 }}>
      <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
    </Box>
  );
};

export default FunnelChart;
