import React, { useEffect, useState } from 'react';
import { IconButton, Stack } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import { Delete } from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import { DialogAlertIconButton } from '@/components/button/DialogAlertButton';
import WidgetBox from '@/components/widget/WidgetBox';
import WidgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';

const WidgetView = () => {
  const { widgetId } = useParams();

  const [loading, setLoading] = useState(false);
  const defaultWidgetInfo = {
    componentId: '',
    createdAt: '',
    datasetId: '',
    datasetType: '',
    delYn: '',
    description: '',
    id: '',
    option: '',
    title: '',
    updatedAt: '',
    widgetViewId: '',
  };
  const [widgetInfo, setWidgetInfo] = useState<WidgetInfo>(defaultWidgetInfo);

  useEffect(() => {
    getWidgetInfo();
  }, []);

  /**
   * 위젯 조회
   */
  const getWidgetInfo = () => {
    setLoading(true);
    // get('/data/dummyWidgetList.json')
    WidgetService.selectWidget(widgetId)
      .then(response => {
        setWidgetInfo(response.data);
        console.log(response.data);
      })
      .finally(() => setLoading(false));
    // .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
  };

  const option = {
    grid: { top: 8, right: 8, bottom: 24, left: 36 },
    xAxis: {
      type: 'category',
      data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: [820, 932, 901, 934, 1290, 1330, 1320],
        type: 'line',
        smooth: true,
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
  };

  const handleRenewClick = () => {
    console.log('renew');
  };

  return (
    <PageTitleBox title="위젯 조회">
      <TitleBox
        title={widgetInfo.title}
        button={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleRenewClick} aria-label="새로고침" color="primary">
              <AutorenewIcon />
            </IconButton>
            <IconButton
              component={RouterLink}
              to={`/widget/modify?id=${widgetId}&name=${widgetInfo.title}`}
              aria-label="수정"
            >
              <EditIcon />
            </IconButton>
            <DialogAlertIconButton icon={<Delete />} size="small">
              {`삭제시 N개의 대시보드에 반영됩니다.`}
              <br /> {`<${widgetInfo.title}>을 삭제하시겠습니까?`}
            </DialogAlertIconButton>
          </Stack>
        }
      >
        <WidgetBox>
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </WidgetBox>
      </TitleBox>
    </PageTitleBox>
  );
};

export default WidgetView;
