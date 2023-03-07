import React, { useContext, useEffect, useState } from 'react';
import { Box, Card, Hidden, useMediaQuery, useTheme } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { useAlert } from 'react-alert';
import { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import PageViewBox from '../../../components/PageViewBox';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import ReloadButton from '@/components/button/ReloadButton';
import ShareButton from '@/components/button/ShareButton';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import shareService from '@/api/shareService';
import { AuthContext } from '@/contexts/AuthContext';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardView = () => {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { userState } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  const [dashboardInfo, setDashboardInfo] = useState({
    title: '',
    widgets: [],
    layout: [],
    updatedAt: '',
    shareYn: 'N',
    uuid: null,
    endDate: null,
  }); // dashboard 정보
  const [layout, setLayout] = useState([]); // grid layout
  // dashboard id
  const [isShareOn, setIsShareOn] = useState(false);
  const [shareLimitDate, setShareLimitDate] = useState(null);

  // init useEffect
  useEffect(() => {
    getDashboardInfo(dashboardId);
  }, [isShareOn]);

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
    if (dashboardInfo.endDate) {
      const date = dateData(dashboardInfo.endDate);
      setShareLimitDate(date);
    }
  }, [dashboardInfo]);

  // dashboard info 조회
  const getDashboardInfo = id => {
    showLoading();
    DashboardService.selectDashboard(id)
      .then(response => {
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

  // refrech 버튼 클릭
  const handleRefreshClick = () => {
    navigate(0);
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

  const handleDeleteSelect = () => {
    alert.success(dashboardInfo.title + '\n대시보드를 삭제하시겠습니까?', {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: () => {
            showLoading();
            DashboardService.deleteDashboard(dashboardId)
              .then(response => {
                if (response.data.status == STATUS.SUCCESS) {
                  navigate('/dashboard', { replace: true });
                  snackbar.success('대시보드가 삭제되었습니다.');
                } else {
                  alert.error('대시보드 삭제에 실패했습니다.\n다시 시도해 주세요.');
                }
              })
              .finally(() => {
                hideLoading();
              });
          },
        },
      ],
    });
  };

  const handleShareToggle = () => {
    const data = {
      userId: userState.userId,
      endDate: shareLimitDate,
    };
    if (!isShareOn) {
      // 공유 off에서 on으로 변경
      if (!shareLimitDate) {
        snackbar.error('공유 기한을 먼저 설정해주세요.');
        return;
      }
      showLoading();
      shareService
        .onShareToken(dashboardId, data)
        .then(response => {
          console.log('buttonOn', response);
          if (response.status === 201) {
            setIsShareOn(true);
          }
        })
        .catch(error => {
          console.log(error);
        })
        .finally(() => {
          hideLoading();
        });
    } else {
      shareService
        .offShareToken(dashboardId, data)
        .then(response => {
          console.log('buttonOff', response);
          if (response.status === 201) {
            setIsShareOn(false);
            setShareLimitDate(null);
          }
        })
        .catch(error => {
          console.log(error);
        })
        .finally(() => {
          hideLoading();
        });
    }
  };

  return (
    <PageTitleBox
      upperTitle="대시보드"
      upperTitleLink="/dashboard"
      title="대시보드 조회"
      sx={{ width: '100%', marginTop: { xs: 0, sm: '22px' }, flex: '1 1 auto', p: { xs: 0 } }}
    >
      <>
        <Seo title={dashboardInfo.title} />
        <PageViewBox
          sx={{ xs: {}, sm: { maxWidth: '1392px', width: '95%' } }}
          title={dashboardInfo.title}
          date={dateData(dashboardInfo.updatedAt)}
          button={
            <>
              <Hidden smDown>
                <ReloadButton
                  size="medium"
                  sx={{ marginRight: '24px', padding: 0 }}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleRefreshClick();
                  }}
                />
                <ModifyButton
                  size="medium"
                  sx={{ marginRight: '24px', padding: 0 }}
                  component={RouterLink}
                  to={`/dashboard/modify?id=${dashboardId}&name=${dashboardInfo.title}`}
                />
                <DeleteButton
                  size="medium"
                  sx={{ marginRight: '24px', padding: 0 }}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDeleteSelect();
                  }}
                />
              </Hidden>
              <ShareButton
                handleShareToggle={handleShareToggle}
                isShareOn={isShareOn}
                shareId={dashboardInfo.uuid}
                shareLimitDate={shareLimitDate}
                setShareLimitDate={setShareLimitDate}
              />
            </>
          }
        >
          <Box
            sx={{
              flex: '1 1 auto',
              width: { sm: '1390px' },
              minWidth: { sm: '1390px' },
              minHeight: { sm: '1080px' },
              backgroundColor: '#f9f9fa',
              borderRadius: '0px 0px 6px 6px',
            }}
          >
            {matches ? (
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
            ) : (
              <ResponsiveGridLayout layouts={{ lg: layout }}>{generateWidget()}</ResponsiveGridLayout>
            )}
          </Box>
        </PageViewBox>
      </>
    </PageTitleBox>
  );
};

export default DashboardView;
