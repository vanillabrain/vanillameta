import React, { useEffect, useState } from 'react';
import { Box, Card, Stack, TextField } from '@mui/material';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import AddWidgetPopupButton from '@/pages/Dashboard/DashboardModify/AddWidgetPopupButton';
import ConfirmCancelButton, { CancelButton } from '@/components/button/ConfirmCancelButton';
import DialogAlertButton from '@/components/button/DialogAlertButton';
import GridLayout, { Responsive, WidthProvider } from 'react-grid-layout';

import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

function DashboardModify(props) {
  const layout = [
    { i: 'a', x: 0, y: 0, w: 1, h: 2, static: true },
    { i: 'b', x: 1, y: 0, w: 3, h: 2, minW: 2, maxW: 4 },
    { i: 'c', x: 4, y: 0, w: 1, h: 2 },
  ];

  const [selectedWidgets, setSelectedWidgets] = useState([]);
  useEffect(() => {
    // 여기서 처리
    if (selectedWidgets.length > 0) {
      console.log(selectedWidgets);
    }
  }, [selectedWidgets]);

  const handleWidgetSelect = items => {
    setSelectedWidgets(items);
  };

  return (
    <PageContainer>
      <PageTitleBox
        title="대시보드 편집"
        button={
          <React.Fragment>
            <ConfirmCancelButton
              confirmProps={{ disabled: true }}
              cancelButton={
                <DialogAlertButton button={<CancelButton cancelLabel="취소" cancelProps={{ component: 'div' }} />}>
                  변경사항을 저장하지 않고 작업을 취소하시겠습니까?
                </DialogAlertButton>
              }
            />
          </React.Fragment>
        }
      >
        <Stack flexDirection="row" justifyContent="space-between" alignItems="baseline" mb={3}>
          <TextField
            id="userDashboardName"
            label=""
            placeholder="대시보드의 이름을 입력해 주세요"
            required
            autoFocus
            sx={{ width: '50%' }}
          />
          <AddWidgetPopupButton label="위젯 추가" widgetSelect={handleWidgetSelect} />
        </Stack>
        <Box
          sx={{
            width: '1280px',
            minHeight: '1080px',
            borderRadius: 1,
            backgroundColor: '#eee',
          }}
        >
          <ResponsiveGridLayout layout={layout} rowHeight={54} compactType={null} cols={{ lg: 20 }}>
            <Card key="a">a</Card>
            <Card key="b">b</Card>
            <Card key="c">c</Card>
          </ResponsiveGridLayout>
        </Box>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DashboardModify;
