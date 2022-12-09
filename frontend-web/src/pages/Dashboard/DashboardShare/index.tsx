import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Card, Stack, Typography } from '@mui/material';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { useAlert } from 'react-alert';
import { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';
import { STATUS } from '@/constant';
import DashboardTitleBox from '../Components/DashboardTitleBox';
import { LoadingContext } from '@/contexts/LoadingContext';
import shareService from '@/api/shareService';
import Logo from '@/layouts/Header/Logo';
import Copyright from '@/components/Copyright';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';

export const DashboardEmpty = () => {
  return (
    <Stack sx={{ width: '1392px', m: 'auto', mt: '32px' }}>
      <Logo sx={{ mb: '5px' }} />
      <DashboardTitleBox>
        <Box
          sx={{
            width: '1390px',
            minWidth: '1390px',
            backgroundColor: '#f9f9fa',
            borderRadius: '0px 0px 6px 6px',
          }}
        >
          <Typography
            sx={{
              margin: '200px auto',
              fontSize: '16px',
              fontWeight: 600,
              textAlign: 'center',
              lineHeight: '1.6',
              color: '#333',
            }}
          >
            대시보드가 존재하지 않습니다.
            <br />
            대시보드의 공유 상태와 URL을 다시 확인해 주세요.
          </Typography>
        </Box>
      </DashboardTitleBox>
      <Copyright sx={{ mt: '40px', mb: '75px' }} />
    </Stack>
  );
};

const DashboardShare = () => {
  const { dashboardUuid } = useParams();
  const ResponsiveGridLayout = WidthProvider(Responsive);
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [dashboardInfo, setDashboardInfo] = useState({
    title: '',
    widgets: [],
    layout: [],
    updatedAt: '',
    shareYn: 'N',
    uuid: null,
  }); // dashboard 정보
  const [layout, setLayout] = useState([]); // grid layout
  // dashboard id
  const [isShareOn, setIsShareOn] = useState(false);

  // init useEffect
  useEffect(() => {
    getShareDashboardInfo(dashboardUuid);
  }, []);

  // dashboardInfo useEffect
  useEffect(() => {
    dashboardInfo.layout.map(item => {
      if (item.i !== undefined) {
        item.i = item.i.toString();
      }
      item.static = true;
    });
    setLayout(dashboardInfo.layout);
    setIsShareOn(dashboardInfo.shareYn === 'Y');
  }, [dashboardInfo]);

  // dashboard info 조회
  const getShareDashboardInfo = token => {
    showLoading();
    shareService
      .selectDashboard(token)
      .then(response => {
        console.log(response);
        if (response.data.status == STATUS.SUCCESS) {
          setDashboardInfo(response.data.data);
        } else {
          alert.error('대시보드 조회에 실패했습니다.\n다시 시도해 주세요.');
        }
      })
      .finally(() => {
        hideLoading();
      });
  };
  // widget 생성
  const generateWidget = () => {
    return dashboardInfo.widgets.map(item => {
      return (
        <Card
          key={item.id}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
            border: 'solid 1px #e2e2e2',
            backgroundColor: '#fff',
          }}
        >
          <WidgetWrapper widgetOption={item} dataSetId={item.datasetId} />
        </Card>
      );
    });
  };

  if (isShareOn) {
    return (
      <Stack sx={{ width: '1392px', m: 'auto', mt: '32px' }}>
        <Seo title={dashboardInfo.title} />
        <Logo sx={{ mb: '5px' }} />
        <DashboardTitleBox
          title={
            <Typography
              variant="subtitle1"
              component="span"
              sx={{
                fontWeight: 500,
                paddingLeft: '18px',
                height: '16px',
                fontFamily: 'Pretendard',
                fontSize: '18px',
                fontStretch: 'normal',
                fontStyle: 'normal',
                lineHeight: 0.89,
                letterSpacing: '-0.18px',
                textAlign: 'left',
                color: '#141414',
              }}
            >
              {dashboardInfo.title}
            </Typography>
          }
          button={
            <Stack direction="row" alignItems="center" sx={{ marginRight: '24px' }}>
              <span
                style={{
                  height: '16px',
                  fontFamily: 'Pretendard',
                  fontSize: '14px',
                  fontWeight: '500',
                  fontStretch: 'normal',
                  fontStyle: 'normal',
                  lineHeight: '1.14',
                  letterSpacing: 'normal',
                  textAlign: 'left',
                  color: '#333333',
                }}
              >
                {`편집일 : ${dateData(dashboardInfo.updatedAt)}`}
              </span>
            </Stack>
          }
        >
          <Box
            sx={{
              width: '1390px',
              minWidth: '1390px',
              minHeight: '1080px',
              backgroundColor: '#f9f9fa',
              borderRadius: '0px 0px 6px 6px',
            }}
          >
            <ResponsiveGridLayout
              rowHeight={88}
              compactType={null}
              cols={{ lg: 12 }}
              layouts={{ lg: layout }}
              containerPadding={{ lg: [24, 24] }}
              margin={{ lg: [24, 24] }}
            >
              {generateWidget()}
            </ResponsiveGridLayout>
          </Box>
        </DashboardTitleBox>
        <Copyright sx={{ mt: '40px', mb: '75px' }} />
      </Stack>
    );
  } else {
    return <DashboardEmpty />;
  }
};

export default DashboardShare;
