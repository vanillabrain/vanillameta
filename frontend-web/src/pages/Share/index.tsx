import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Card, Stack, Typography } from '@mui/material';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { useAlert } from 'react-alert';
import { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';
import PageViewBox from '../../components/PageViewBox';
import { LoadingContext } from '@/contexts/LoadingContext';
import shareService from '@/api/shareService';
import { LandingLogo } from '@/layouts/Header/Logo';
import Copyright from '@/components/Copyright';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';
import { setShareToken } from '@/helpers/shareHelper';
import { MAX_WIDTH } from '@/constant';

const ResponsiveGridLayout = WidthProvider(Responsive);

const Share = () => {
  const { dashboardUuid } = useParams();
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [dashboardInfo, setDashboardInfo] = useState({
    title: '',
    widgets: [],
    layout: [],
    updatedAt: '',
    shareYn: 'N',
    uuid: null,
    shareToken: null,
  }); // dashboard 정보
  const [layout, setLayout] = useState([]); // grid layout
  // dashboard id
  const [isShareOn, setIsShareOn] = useState(false);
  const [isInvalidData, setIsInvalidData] = useState(null);

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
    if (dashboardInfo.shareToken) {
      setShareToken(dashboardInfo.shareToken);
    }
  }, [dashboardInfo]);

  // dashboard info 조회
  const getShareDashboardInfo = uuid => {
    showLoading();
    shareService
      .selectDashboard(uuid)
      .then(response => {
        console.log('shareDashboard', response);
        if (response.status == 200) {
          setDashboardInfo(response.data.data);
        }
      })
      .catch(error => {
        console.log(error);
        setIsInvalidData(error.response.status);
        console.log(isInvalidData);
        if (error.response.status === 401 && error.response.data.data.message === 'expired date') {
          alert.error('대시보드의 공유 기간이 만료되었습니다.');
        } else if (
          error.response.status === 500
          // && error.response.data.data.message === 'not exist uuid'
        ) {
          alert.error('대시보드가 존재하지 않습니다.');
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

  // 데이터가 없는 상태별 텍스트
  const generateInvalidText = () => {
    if (!isInvalidData) {
      return <>데이터를 불러오고 있습니다.</>;
    } else if (isInvalidData === 401) {
      return (
        <>
          대시보드의 공유 기간이 만료되었습니다.
          <br />
          대시보드의 공유 상태를 다시 확인해 주세요.
        </>
      );
    } else {
      return (
        <>
          대시보드가 존재하지 않습니다.
          <br />
          대시보드의 URL을 다시 확인해 주세요.
        </>
      );
    }
  };

  return (
    <Stack sx={{ width: '100%', maxWidth: MAX_WIDTH, m: 'auto', mt: '32px' }}>
      <LandingLogo sx={{ ml: '20px', mb: '5px' }} />
      {!isShareOn ? (
        // 공유 URL이 유효하지 않을 때 보여줄 화면
        <PageViewBox sx={{ borderTop: '1px solid #ddd' }}>
          <Box
            sx={{
              flex: '1 1 auto',
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
              {generateInvalidText()}
            </Typography>
          </Box>
        </PageViewBox>
      ) : (
        <PageViewBox
          title={dashboardInfo.title}
          date={`${dateData(dashboardInfo.updatedAt)}`}
          sx={{ borderTop: '1px solid #ddd' }}
        >
          <Seo title={dashboardInfo.title} />
          <Box
            sx={{
              flex: '1 1 auto',
              minHeight: { sm: '1080px' },
              backgroundColor: '#f9f9fa',
              borderRadius: '0px 0px 6px 6px',
            }}
          >
            <ResponsiveGridLayout
              rowHeight={88}
              compactType={null}
              breakpoints={{ xs: 0, md: 800, lg: 1000 }}
              cols={{ xs: 2, md: 8, lg: 12 }}
              layouts={{ xs: layout, md: layout, lg: layout }}
              containerPadding={{ xs: [20, 20], md: [20, 20], lg: [24, 24] }}
              margin={{ xs: [20, 20], md: [20, 20], lg: [24, 24] }}
            >
              {generateWidget()}
            </ResponsiveGridLayout>
          </Box>
        </PageViewBox>
      )}
      <Copyright sx={{ mt: '40px', mb: '75px' }} />
    </Stack>
  );
};

export default Share;
