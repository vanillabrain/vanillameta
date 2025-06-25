import { Component } from '../../component/entities/component.entity';
import { DataSource } from 'typeorm';
import { YesNo } from '../../common/enum/yn.enum';

export const componentSeederData = [
  {
    id: 1,
    type: 'CHART_LINE',
    title: '선형 차트',
    description: 'Line Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true
    }),
    icon: 'icon/ct-line.svg',
    seq: 3,
    useYn: YesNo.YES
  },
  {
    id: 2,
    type: 'CHART_AREA',
    title: '영역형 차트',
    description: 'Area Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true
    }),
    icon: 'icon/ct-area.svg',
    seq: 4,
    useYn: YesNo.YES
  },
  {
    id: 3,
    type: 'CHART_BAR',
    title: '세로 막대형 차트',
    description: 'Bar Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true
    }),
    icon: 'icon/ct-bar.svg',
    seq: 5,
    useYn: YesNo.YES
  },
  {
    id: 4,
    type: 'CHART_COLUMN',
    title: '가로 막대형 차트',
    description: 'Column Chart',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true
    }),
    icon: 'icon/ct-column.svg',
    seq: 6,
    useYn: YesNo.YES
  },
  {
    id: 5,
    type: 'MIXED_CHART_LINE_BAR',
    title: '선형과 세로 막대형 복합 차트',
    description: 'Mixed Line and Bar Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum',
          type: 'line'
        },
        {
          color: '#47a8ea',
          aggregation: 'sum',
          type: 'bar'
        }
      ],
      label: true
    }),
    icon: 'icon/ct-mixed-line-bar.svg',
    seq: 7,
    useYn: YesNo.YES
  },
  {
    id: 6,
    type: 'CHART_PIE',
    title: '원형 차트',
    description: 'Pie Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        color: [],
        aggregation: 'sum',
        label: '{b}'
      }
    }),
    icon: 'icon/ct-pie.svg',
    seq: 13,
    useYn: YesNo.YES
  },
  {
    id: 7,
    type: 'CHART_NIGHTINGALE',
    title: '나이팅게일 차트',
    description: 'Nightingale Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        color: [],
        aggregation: 'sum',
        label: '{b}',
        radius: [
          '20%',
          '75%'
        ]
      }
    }),
    icon: 'icon/ct-nightingale.svg',
    seq: 15,
    useYn: YesNo.YES
  },
  {
    id: 8,
    type: 'CHART_BUBBLE',
    title: '거품형 차트',
    description: 'Bubble Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          title: '이름 1',
          color: '#6aa7eb'
        }
      ]
    }),
    icon: 'icon/ct-bubble.svg',
    seq: 18,
    useYn: YesNo.YES
  },
  {
    id: 9,
    type: 'CHART_RADAR',
    title: '방사형 차트',
    description: 'Radar Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          color: '#2870c5',
          aggregation: 'sum'
        }
      ],
      label: true
    }),
    icon: 'icon/ct-radar.svg',
    seq: 16,
    useYn: YesNo.YES
  },
  {
    id: 10,
    type: 'CHART_SCATTER',
    title: '분산형 차트',
    description: 'Scatter Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          title: '이름 1',
          symbolSize: '20',
          color: '#6aa7eb'
        }
      ]
    }),
    icon: 'icon/ct-scatter.svg',
    seq: 17,
    useYn: YesNo.YES
  },
  {
    id: 11,
    type: 'CHART_DONUT',
    title: '도넛형 차트',
    description: 'Donut Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        color: [],
        aggregation: 'sum',
        label: '{b}',
        radius: [
          '30%',
          '75%'
        ]
      }
    }),
    icon: 'icon/ct-donut.svg',
    seq: 14,
    useYn: YesNo.YES
  },
  {
    id: 12,
    type: 'BOARD_NUMERIC',
    title: '숫자판',
    description: 'Score Board',
    category: 'SCORE',
    option: JSON.stringify({
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score.svg',
    seq: 1,
    useYn: YesNo.YES
  },
  {
    id: 13,
    type: 'BOARD_TABLE',
    title: '표',
    description: 'Data Grid',
    category: 'TABLE',
    option: JSON.stringify({
      columns: []
    }),
    icon: 'icon/ct-grid.svg',
    seq: 2,
    useYn: YesNo.YES
  },
  {
    id: 14,
    type: 'CHART_STACKED_LINE',
    title: '누적 선형 차트',
    description: 'Stacked Line Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true
    }),
    icon: 'icon/ct-stacked-line.svg',
    seq: 8,
    useYn: YesNo.YES
  },
  {
    id: 15,
    type: 'CHART_STACKED_AREA',
    title: '누적 영역형 차트',
    description: 'Stacked Area Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true
    }),
    icon: 'icon/ct-stacked-area.svg',
    seq: 9,
    useYn: YesNo.YES
  },
  {
    id: 16,
    type: 'CHART_STACKED_COLUMN',
    title: '누적 가로 막대형 차트',
    description: 'Stacked Column Chart',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true
    }),
    icon: 'icon/ct-stacked-column.svg',
    seq: 10,
    useYn: YesNo.YES
  },
  {
    id: 17,
    type: 'CHART_STACKED_BAR',
    title: '누적 세로 막대형 차트',
    description: 'Stacked Bar Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true
    }),
    icon: 'icon/ct-stacked-bar.svg',
    seq: 11,
    useYn: YesNo.YES
  },
  {
    id: 19,
    type: 'CHART_TREEMAP',
    title: '트리맵 차트',
    description: 'Treemap Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        color: [
          '#2870c4',
          '#4ecef6',
          '#ffd43b',
          '#fa5a5a'
        ],
        aggregation: 'sum'
      },
      label: true
    }),
    icon: 'icon/ct-treemap.svg',
    seq: 19,
    useYn: YesNo.YES
  },
  {
    id: 20,
    type: 'CHART_CANDLESTICK',
    title: '캔들스틱 차트',
    description: 'Candlestick Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#FA5A5A',
          aggregation: 'sum'
        },
        {
          color: '#2870C4',
          aggregation: 'sum'
        },
        {
          color: '#E03B3B',
          aggregation: 'sum'
        },
        {
          color: '#215DA3',
          aggregation: 'sum'
        }
      ]
    }),
    icon: 'icon/ct-candlestick.svg',
    seq: 22,
    useYn: YesNo.YES
  },
  {
    id: 21,
    type: 'CHART_GAUGE',
    title: '계기판 차트',
    description: 'Gauge Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      color: '#6aa7eb',
      aggregation: 'sum'
    }),
    icon: 'icon/ct-gauge.svg',
    seq: 23,
    useYn: YesNo.YES
  },
  {
    id: 22,
    type: 'CHART_SUNBURST',
    title: '선버스트 차트',
    description: 'Sunburst Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        color: [
          '#2870c4',
          '#4ecef6',
          '#ffd43b',
          '#fa5a5a'
        ],
        aggregation: 'sum'
      },
      label: true
    }),
    icon: 'icon/ct-sunburst.svg',
    seq: 20,
    useYn: YesNo.YES
  },
  {
    id: 23,
    type: 'CHART_HEATMAP',
    title: '히트맵 차트',
    description: 'Heatmap Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      color: [
        '#2870c4',
        '#4ecef6',
        '#ffd43b',
        '#fa5a5a'
      ],
      aggregation: 'sum'
    }),
    icon: 'icon/ct-heatmap.svg',
    seq: 21,
    useYn: YesNo.YES
  },
  {
    id: 24,
    type: 'CHART_FUNNEL',
    title: '깔때기형 차트',
    description: 'Funnel Chart',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: {
        color: [],
        aggregation: 'sum'
      }
    }),
    icon: 'icon/ct-funnel.svg',
    seq: 24,
    useYn: YesNo.YES
  },
  {
    id: 25,
    type: 'CHART_3D_BAR',
    title: '3D 막대형 차트',
    description: '3D Bar Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          aggregation: 'sum'
        }
      ],
      color: [
        '#2870c4',
        '#4ecef6',
        '#ffd43b',
        '#fa5a5a'
      ]
    }),
    icon: 'icon/ct-3d-bar.svg',
    seq: 28,
    useYn: YesNo.YES
  },
  {
    id: 26,
    type: 'CHART_3D_LINE',
    title: '3D 선형 차트',
    description: '3D Line Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ]
    }),
    icon: 'icon/ct-3d-line.svg',
    seq: 27,
    useYn: YesNo.YES
  },
  {
    id: 27,
    type: 'CHART_3D_SCATTER',
    title: '3D 분산형 차트',
    description: '3D Scatter Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          title: '이름 1',
          symbolSize: '20',
          color: '#6aa7eb'
        }
      ]
    }),
    icon: 'icon/ct-3d-scatter.svg',
    seq: 29,
    useYn: YesNo.YES
  },
  {
    id: 28,
    type: 'CHART_3D_BUBBLE',
    title: '3D 거품형 차트',
    description: '3D Bubble Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          title: '이름 1',
          color: '#6aa7eb'
        }
      ]
    }),
    icon: 'icon/ct-3d-bubble.svg',
    seq: 30,
    useYn: YesNo.YES
  },
  {
    id: 29,
    type: 'CHART_WATERFALL_BAR',
    title: '폭포수 세로 차트',
    description: 'Waterfall Bar Chart',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: [
        {
          aggregation: 'sum'
        }
      ],
      color: [
        '#6aa7eb',
        '#fa5a5a'
      ],
      mark: true
    }),
    icon: '',
    seq: null,
    useYn: YesNo.YES
  },
  {
    id: 30,
    type: 'CHART_WATERFALL_COLUMN',
    title: '폭포수 가로 차트',
    description: 'Waterfall Column Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          aggregation: 'sum'
        }
      ],
      color: [
        '#6aa7eb',
        '#fa5a5a'
      ],
      mark: true
    }),
    icon: '',
    seq: null,
    useYn: YesNo.YES
  },
  {
    id: 31,
    type: 'CHART_POLAR_BAR',
    title: '극좌표 막대형 차트',
    description: 'Polar Bar Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      radius: [
        '10%',
        '75%'
      ]
    }),
    icon: 'icon/ct-polar-bar.svg',
    seq: 25,
    useYn: YesNo.YES
  },
  {
    id: 32,
    type: 'MIXED_CHART_LINE_PIE',
    title: '선형과 원형 복합 차트',
    description: 'Mixed Line and Pie Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      mark: true
    }),
    icon: 'icon/ct-pie-line.svg',
    seq: 31,
    useYn: YesNo.YES
  },
  {
    id: 33,
    type: 'CHART_POLAR_STACKED_BAR',
    title: '극좌표 누적 막대형 차트',
    description: 'Polar Stacked Bar Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      radius: [
        '10%',
        '75%'
      ]
    }),
    icon: 'icon/ct-polar-stacked-bar.svg',
    seq: 26,
    useYn: YesNo.YES
  },
  {
    id: 34,
    type: 'MIXED_CHART_AREA_PIE',
    title: '영역형과 원형 복합 차트',
    description: 'Mixed Area and Pie Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      mark: true
    }),
    icon: 'icon/ct-pie-area.svg',
    seq: 32,
    useYn: YesNo.YES
  },
  {
    id: 35,
    type: 'MIXED_CHART_BAR_PIE',
    title: '세로 막대형과 원형 복합 차트',
    description: 'Mixed Bar and Pie Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      mark: true
    }),
    icon: 'icon/ct-pie-bar.svg',
    seq: 33,
    useYn: YesNo.YES
  },
  {
    id: 36,
    type: 'MIXED_CHART_COLUMN_PIE',
    title: '가로 막대형과 원형 복합 차트',
    description: 'Mixed Column and Pie Chart',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      mark: true
    }),
    icon: 'icon/ct-pie-column.svg',
    seq: 34,
    useYn: YesNo.YES
  },
  {
    id: 37,
    type: 'MIXED_CHART_STACKED_BAR_PIE',
    title: '누적 세로 막대형과 원형 복합 차트',
    description: 'Mixed Stacked-Bar and Pie Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      label: true
    }),
    icon: 'icon/ct-pie-stacked-bar.svg',
    seq: 35,
    useYn: YesNo.YES
  },
  {
    id: 38,
    type: 'MIXED_CHART_STACKED_COLUMN_PIE',
    title: '누적 가로 막대형과 원형 복합 차트',
    description: 'Mixed Stacked-Column and Pie Chart',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      label: true
    }),
    icon: 'icon/ct-pie-stacked-column.svg',
    seq: 36,
    useYn: YesNo.YES
  },
  {
    id: 39,
    type: 'MIXED_CHART_STACKED_LINE_PIE',
    title: '누적 선형과 원형 복합 차트',
    description: 'Mixed Stacked-Line and Pie Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      label: true
    }),
    icon: 'icon/ct-pie-stacked-line.svg',
    seq: 37,
    useYn: YesNo.YES
  },
  {
    id: 40,
    type: 'MIXED_CHART_STACKED_AREA_PIE',
    title: '누적 영역형과 원형 복합 차트',
    description: 'Mixed Stacked-Area and Pie Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      pie: {
        color: [],
        center: [
          '80%',
          '20%'
        ],
        radius: '20%',
        aggregation: 'sum',
        label: '{b}'
      },
      label: true
    }),
    icon: 'icon/ct-pie-stacked-area.svg',
    seq: 38,
    useYn: YesNo.YES
  },
  {
    id: 41,
    type: 'MIXED_CHART_DONUT_PIE',
    title: '도넛형과 원형 복합 차트',
    description: 'Mixed Donut and Pie Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        aggregation: 'sum',
        radius: [
          '45%',
          '60%'
        ],
        label: '{b}'
      },
      pie: {
        radius: '30%',
        aggregation: 'sum',
        label: '{b}'
      },
      color: []
    }),
    icon: 'icon/ct-pie-donut.svg',
    seq: 39,
    useYn: YesNo.YES
  },
  {
    id: 42,
    type: 'MIXED_CHART_NIGHTINGALE_PIE',
    title: '나이팅게일과 원형 복합 차트',
    description: 'Mixed Nightingale and Pie Chart',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        aggregation: 'sum',
        radius: [
          '45%',
          '60%'
        ],
        label: '{b}'
      },
      pie: {
        radius: '30%',
        aggregation: 'sum',
        label: '{b}'
      },
      color: []
    }),
    icon: 'icon/ct-pie-nightingale.svg',
    seq: 40,
    useYn: YesNo.YES
  },
  {
    id: 43,
    type: 'MIXED_CHART_LINE_STACKED_BAR',
    title: '선형과 누적 세로 막대형 복합 차트',
    description: 'Mixed Line and Stacked-Bar Chart',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum',
          type: 'line'
        },
        {
          color: '#47a8ea',
          aggregation: 'sum',
          type: 'bar'
        }
      ],
      label: true
    }),
    icon: 'icon/ct-mixed-line-stacked-bar.svg',
    seq: 12,
    useYn: YesNo.YES
  },
  {
    id: 44,
    type: 'MIXED_CHART_LINE_BOARD_NUMERIC',
    title: '선형 차트와 숫자 보드',
    description: 'Line Chart and Score Board',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-line.svg',
    seq: 41,
    useYn: YesNo.YES
  },
  {
    id: 45,
    type: 'MIXED_CHART_AREA_BOARD_NUMERIC',
    title: '영역형 차트와 숫자 보드',
    description: 'Area Chart and Score Board',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-area.svg',
    seq: 42,
    useYn: YesNo.YES
  },
  {
    id: 46,
    type: 'MIXED_CHART_BAR_BOARD_NUMERIC',
    title: '세로 막대형 차트와 숫자 보드',
    description: 'Bar Chart and Score Board',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-bar.svg',
    seq: 43,
    useYn: YesNo.YES
  },
  {
    id: 47,
    type: 'MIXED_CHART_COLUMN_BOARD_NUMERIC',
    title: '가로 막대형 차트와 숫자 보드',
    description: 'Column Chart and Score Board',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      mark: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-column.svg',
    seq: 44,
    useYn: YesNo.YES
  },
  {
    id: 48,
    type: 'MIXED_CHART_STACKED_LINE_BOARD_NUMERIC',
    title: '누적 선형 차트와 숫자 보드',
    description: 'Stacked Line Chart and Score Board',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-stacked-line.svg',
    seq: 45,
    useYn: YesNo.YES
  },
  {
    id: 49,
    type: 'MIXED_CHART_STACKED_AREA_BOARD_NUMERIC',
    title: '누적 영역형 차트와 숫자 보드',
    description: 'Stacked Area Chart and Score Board',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-stacked-area.svg',
    seq: 46,
    useYn: YesNo.YES
  },
  {
    id: 50,
    type: 'MIXED_CHART_STACKED_BAR_BOARD_NUMERIC',
    title: '누적 세로 막대형 차트와 숫자 보드',
    description: 'Stacked Bar Chart and Score Board',
    category: 'HORIZONTAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-stacked-bar.svg',
    seq: 47,
    useYn: YesNo.YES
  },
  {
    id: 51,
    type: 'MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC',
    title: '누적 가로 막대형 차트와 숫자 보드',
    description: 'Stacked Column Chart and Score Board',
    category: 'VERTICAL',
    option: JSON.stringify({
      series: [
        {
          color: '#6aa7eb',
          aggregation: 'sum'
        }
      ],
      label: true,
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-stacked-column.svg',
    seq: 48,
    useYn: YesNo.YES
  },
  {
    id: 52,
    type: 'MIXED_CHART_DONUT_BOARD_NUMERIC',
    title: '도넛형 차트와 숫자 보드',
    description: 'Donut Chart and Score Board',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        color: [],
        aggregation: 'sum',
        label: '{b}',
        radius: [
          '40%',
          '75%'
        ]
      },
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-donut.svg',
    seq: 49,
    useYn: YesNo.YES
  },
  {
    id: 53,
    type: 'MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC',
    title: '나이팅게일 차트와 숫자 보드',
    description: 'Nightingale Chart and Score Board',
    category: 'SQUARE',
    option: JSON.stringify({
      series: {
        color: [],
        aggregation: 'sum',
        label: '{b}',
        radius: [
          '40%',
          '75%'
        ]
      },
      header: {
        title: '타이틀을 입력하세요',
        fontSize: 20,
        color: '#4A4A4A'
      },
      content: {
        aggregation: 'sum',
        fontSize: 50,
        color: '#4A4A4A'
      }
    }),
    icon: 'icon/ct-score-nightingale.svg',
    seq: 50,
    useYn: YesNo.YES
  }
];

export async function seedComponents(dataSource: DataSource) {
  const componentRepository = dataSource.getRepository(Component);
  
  // 기존 데이터 확인
  const existingCount = await componentRepository.count();
  
  if (existingCount > 0) {
    console.log(`Components already seeded. Found ${existingCount} components.`);
    return;
  }

  // 데이터 삽입
  try {
    await componentRepository.save(componentSeederData);
    console.log(`Successfully seeded ${componentSeederData.length} components`);
  } catch (error) {
    console.error('Error seeding components:', error);
    throw error;
  }
}