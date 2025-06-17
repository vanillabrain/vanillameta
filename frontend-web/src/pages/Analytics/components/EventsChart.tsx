import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { TimeRange } from '../types';

interface Props {
  events: any[];
  timeRange: TimeRange;
}

const EventsChart: React.FC<Props> = ({ events, timeRange }) => {
  const chartOption = useMemo(() => {
    // 시간별로 이벤트 그룹화
    const eventsByTime = events.reduce((acc, event) => {
      const date = new Date(event.createdAt);
      const key = getTimeKey(date, timeRange);
      
      if (!acc[key]) {
        acc[key] = { time: key, count: 0, categories: {} };
      }
      
      acc[key].count++;
      acc[key].categories[event.category] = (acc[key].categories[event.category] || 0) + 1;
      
      return acc;
    }, {});

    const timeData = Object.values(eventsByTime).sort((a: any, b: any) => 
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    const categories = [...new Set(events.map(e => e.category))];
    const series = categories.map(category => ({
      name: category,
      type: 'line',
      smooth: true,
      data: timeData.map((item: any) => item.categories[category] || 0),
      lineStyle: { width: 2 },
      symbolSize: 6,
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
        },
      },
      legend: {
        data: categories,
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timeData.map((item: any) => formatTimeLabel(item.time, timeRange)),
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
        name: '이벤트 수',
      },
      series,
    };
  }, [events, timeRange]);

  const getTimeKey = (date: Date, timeRange: TimeRange): string => {
    switch (timeRange) {
      case TimeRange.LAST_HOUR:
      case TimeRange.LAST_24_HOURS:
        return date.toISOString().slice(0, 13) + ':00:00'; // 시간별
      case TimeRange.LAST_7_DAYS:
      case TimeRange.LAST_30_DAYS:
        return date.toISOString().slice(0, 10); // 일별
      case TimeRange.LAST_90_DAYS:
        // 주별
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      default:
        return date.toISOString().slice(0, 10);
    }
  };

  const formatTimeLabel = (time: string, timeRange: TimeRange): string => {
    const date = new Date(time);
    
    switch (timeRange) {
      case TimeRange.LAST_HOUR:
      case TimeRange.LAST_24_HOURS:
        return date.toLocaleString('ko-KR', { 
          month: 'numeric', 
          day: 'numeric', 
          hour: 'numeric' 
        });
      case TimeRange.LAST_7_DAYS:
      case TimeRange.LAST_30_DAYS:
        return date.toLocaleDateString('ko-KR', { 
          month: 'numeric', 
          day: 'numeric' 
        });
      case TimeRange.LAST_90_DAYS:
        return `${date.getMonth() + 1}/${date.getDate()} 주`;
      default:
        return date.toLocaleDateString('ko-KR');
    }
  };

  return (
    <Box sx={{ height: 400 }}>
      <ReactECharts 
        option={chartOption} 
        style={{ height: '100%', width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </Box>
  );
};

export default EventsChart;