import React, { useContext, useEffect, useRef, useState } from 'react';
import { Box, Button, Card, MenuItem, Select, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import DashboardService from '@/api/dashboardService';
import AiService from '@/api/aiService';
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
import { readLayouts } from '../readLayouts';
import DashboardAnalysis from '../Components/DashboardAnalysis';

const ResponsiveGridLayout = WidthProvider(Responsive);
const defaultDashboardInfo = {
  title: '',
  widgets: [],
  layout: [],
  updatedAt: '',
  shareYn: 'N',
  uuid: null,
  endDate: null,
};

const DashboardView = () => {
  const { t } = useTranslation();
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { userState } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [dashboardInfo, setDashboardInfo] = useState(defaultDashboardInfo); // dashboard 정보
  const [assistantOpen, setAssistantOpen] = useState(false);
  const dashboardRequest = useRef(0);
  const [layout, setLayout] = useState([]); // grid layout
  // dashboard id
  const [isShareOn, setIsShareOn] = useState(false);
  const [shareLimitDate, setShareLimitDate] = useState(null);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(0); // auto-refresh 주기 (초, 0=off)

  // auto-refresh
  useEffect(() => {
    if (!refreshIntervalSec) return;
    const timer = setInterval(() => {
      getDashboardInfo(dashboardId);
      setLayoutVersion(v => v + 1); // 위젯 데이터 갱신을 위한 remount
    }, refreshIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [refreshIntervalSec, dashboardId]);

  const [layoutVersion, setLayoutVersion] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  /**
   * AI 대시보드 인사이트 생성
   */
  const handleInsightClick = () => {
    setInsightLoading(true);
    AiService.dashboardInsight(dashboardId)
      .then(response => {
        if (response.data.status === STATUS.SUCCESS) {
          setInsight(response.data.data.insight);
        } else {
          alert.error(response.data.message || t('dashboard.insightFailed'));
        }
      })
      .catch(error => {
        alert.error(error.message);
      })
      .finally(() => {
        setInsightLoading(false);
      });
  };

  useEffect(() => {
    setDashboardInfo(defaultDashboardInfo);
    setLayout([]);
    setShareLimitDate(null);
  }, [dashboardId]);

  // init useEffect
  useEffect(() => {
    return getDashboardInfo(dashboardId);
  }, [dashboardId, isShareOn]);

  // dashboardInfo useEffect
  useEffect(() => {
    setLayout(
      dashboardInfo.layout
        .filter(item => item && typeof item === 'object')
        .map(item => ({ ...item, i: item.i?.toString(), static: true })),
    );
    setIsShareOn(dashboardInfo.shareYn === 'Y');
    setShareLimitDate(dashboardInfo.endDate ? dateData(dashboardInfo.endDate) : null);
  }, [dashboardInfo]);

  // dashboard info 조회
  const getDashboardInfo = id => {
    dashboardRequest.current += 1;
    const request = dashboardRequest.current;
    showLoading();
    DashboardService.selectDashboard(id)
      .then(response => {
        if (request !== dashboardRequest.current) return;
        const dashboard = response.data.data;
        if (
          response.data.status === STATUS.SUCCESS &&
          dashboard &&
          Array.isArray(dashboard.layout) &&
          Array.isArray(dashboard.widgets)
        ) {
          setDashboardInfo(dashboard);
        } else {
          throw new Error(t('dashboard.loadFailed'));
        }
      })
      .catch(() => {
        if (request !== dashboardRequest.current) return;
        setDashboardInfo(defaultDashboardInfo);
        setLayout([]);
        alert.error(t('dashboard.loadFailed'));
      })
      .finally(() => {
        hideLoading();
      });
    return () => {
      if (request === dashboardRequest.current) dashboardRequest.current += 1;
    };
  };

  // refrech 버튼 클릭
  const handleRefreshClick = () => {
    navigate(0);
  };

  // widget 생성
  const generateWidget = () => {
    return dashboardInfo.widgets.map((item, index) => {
      if (!item || !item.id) return null;
      return (
        <Card
          key={item.id}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            boxShadow: '0 2px 6px rgba(42, 50, 62, 0.06)',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: '#fff',
          }}
        >
          <WidgetWrapper widgetOption={item} dataSetId={item.datasetId} size={dashboardInfo.layout[index]?.w} />
        </Card>
      );
    });
  };

  const handleDeleteSelect = () => {
    alert.success(
      <Box sx={{ span: { fontWeight: 600 } }}>
        <span>{dashboardInfo.title}</span>
        <br />
        {t('dashboard.deleteConfirm')}
      </Box>,
      {
        closeCopy: t('data.cancel'),
        actions: [
          {
            copy: t('data.confirm'),
            onClick: () => {
              showLoading();
              DashboardService.deleteDashboard(dashboardId)
                .then(response => {
                  if (response.data.status == STATUS.SUCCESS) {
                    navigate('/dashboard', { replace: true });
                    snackbar.success(t('dashboard.deleted'));
                  } else {
                    alert.error(t('dashboard.deleteFailed'));
                  }
                })
                .finally(() => {
                  hideLoading();
                });
            },
          },
        ],
      },
    );
  };

  const handleShareToggle = () => {
    const data = {
      userId: userState.userId,
      endDate: shareLimitDate,
    };
    if (!isShareOn) {
      // 공유 off에서 on으로 변경
      if (!shareLimitDate) {
        snackbar.error(t('dashboard.shareExpireFirst'));
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
      upperTitle={t('dashboard.view')}
      upperTitleLink="/dashboard"
      title={t('dashboard.view')}
      sx={{ width: '100%', marginTop: { xs: 0, sm: '22px' }, flex: '1 1 auto', p: { xs: 0 } }}
    >
      <>
        <Seo title={dashboardInfo.title} />
        <Box sx={{ width: { xs: '100%', lg: assistantOpen ? 'calc(100% - 400px)' : '100%' }, minWidth: 0 }}>
          <PageViewBox
            preserveChildren
            title={dashboardInfo.title}
            date={dateData(dashboardInfo.updatedAt)}
            button={
              <Box
                sx={{
                  display: 'contents',
                  '& .MuiButton-root': {
                    minHeight: { xs: 40, sm: 36 },
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: 13,
                    boxShadow: 'none',
                  },
                  '& .MuiButton-outlined': { borderColor: '#d8e0eb', color: 'text.primary' },
                  '& .MuiIconButton-root': { width: 36, height: 36, borderRadius: '8px', '&:hover': { bgcolor: '#edf3fb' } },
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'contents' } }}>
                  <Select
                    size="small"
                    displayEmpty
                    inputProps={{ 'aria-label': t('dashboard.autoRefresh') }}
                    value={refreshIntervalSec}
                    onChange={event => setRefreshIntervalSec(Number(event.target.value))}
                    sx={{
                      height: '36px',
                      mr: '8px',
                      fontSize: '12px',
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      '& fieldset': { borderColor: '#d8e0eb' },
                    }}
                  >
                    <MenuItem value={0}>{t('dashboard.autoRefreshOff')}</MenuItem>
                    <MenuItem value={15}>{t('dashboard.sec15')}</MenuItem>
                    <MenuItem value={30}>{t('dashboard.sec30')}</MenuItem>
                    <MenuItem value={60}>{t('dashboard.min1')}</MenuItem>
                    <MenuItem value={300}>{t('dashboard.min5')}</MenuItem>
                  </Select>
                  <ReloadButton
                    aria-label={t('dashboard.refresh')}
                    size="medium"
                    sx={{ marginRight: 0.5, padding: 1 }}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRefreshClick();
                    }}
                  />
                  <ModifyButton
                    aria-label={t('dashboardModify.edit')}
                    size="medium"
                    sx={{ marginRight: 0.5, padding: 1 }}
                    component={RouterLink}
                    to={`/dashboard/modify?id=${dashboardId}&name=${dashboardInfo.title}`}
                  />
                  <DeleteButton
                    aria-label={t('dashboard.delete')}
                    size="medium"
                    sx={{ marginRight: 0.5, padding: 1 }}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDeleteSelect();
                    }}
                  />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  component={RouterLink}
                  to={`/dashboard/${dashboardId}/edit-charts`}
                  sx={{ mr: 1, flexShrink: 0 }}
                >
                  차트·배치 편집
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleInsightClick}
                  disabled={insightLoading}
                  sx={{ mr: '8px', backgroundColor: '#fff', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {insightLoading ? t('dashboard.insightLoading') : t('dashboard.insight')}
                </Button>
                <ShareButton
                  handleShareToggle={handleShareToggle}
                  isShareOn={isShareOn}
                  shareId={dashboardInfo.uuid}
                  shareLimitDate={shareLimitDate}
                  setShareLimitDate={setShareLimitDate}
                />
              </Box>
            }
          >
            {insight && (
              <Box
                sx={{
                  mx: { xs: '20px', sm: '24px' },
                  mt: '16px',
                  p: '16px 20px',
                  border: '1px solid #d6e3f5',
                  borderRadius: '8px',
                  backgroundColor: '#f4f8ff',
                }}
              >
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#043f84', mb: '6px' }}>
                  {t('dashboard.aiInsight')}
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {insight}
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                backgroundColor: '#f9f9fa',
                borderRadius: '0px 0px 6px 6px',
              }}
            >
              <DashboardAnalysis
                key={dashboardId}
                dashboardId={dashboardId}
                revision={dashboardInfo.updatedAt}
                onAssistantOpenChange={setAssistantOpen}
                onSaved={() => getDashboardInfo(dashboardId)}
              >
                <ResponsiveGridLayout
                  key={layoutVersion}
                  rowHeight={76}
                  compactType={null}
                  breakpoints={{ xs: 0, md: 800, lg: 1000 }}
                  cols={{ xs: 1, md: 8, lg: 12 }}
                  layouts={readLayouts(layout)}
                  containerPadding={{ xs: [12, 12], md: [16, 16], lg: [20, 20] }}
                  margin={{ xs: [12, 12], md: [16, 16], lg: [20, 20] }}
                >
                  {generateWidget()}
                </ResponsiveGridLayout>
              </DashboardAnalysis>
            </Box>
          </PageViewBox>
        </Box>
      </>
    </PageTitleBox>
  );
};

export default DashboardView;
