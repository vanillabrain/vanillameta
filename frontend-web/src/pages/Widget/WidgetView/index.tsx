import React, { useEffect, useState } from 'react';
import { Card, IconButton, Stack } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import { Delete } from '@mui/icons-material';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import { DialogAlertIconButton } from '@/components/button/DialogAlertButton';
import WidgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';

const WidgetView = () => {
  const defaultWidgetInfo: WidgetInfo = {
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

  const { widgetId } = useParams();
  const [loading, setLoading] = useState(false);

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
        <Card sx={{ width: '100%', height: '100%', minHeight: '500px', borderRadius: 1 }}>
          <WidgetWrapper
            widgetOption={widgetInfo}
            dataSetId={widgetInfo.datasetId}
            sx={{ width: '100%', height: '100%', borderRadius: 1 }}
          />
        </Card>
      </TitleBox>
    </PageTitleBox>
  );
};

export default WidgetView;
