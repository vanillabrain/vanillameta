import React, { useContext, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SquarePen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import DashboardService from '@/api/dashboardService';
import { DashboardDeleteReceipt, fetchDashboardDeleteImpact } from '@/api/dashboardDeletionService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import AiService from '@/api/aiService';
import { STATUS } from '@/constant';
import PageViewBox from '../../../components/PageViewBox';
import DeleteButton from '@/components/button/DeleteButton';
import ReloadButton from '@/components/button/ReloadButton';
import ShareButton from '@/components/button/ShareButton';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import shareService from '@/api/shareService';
import { AuthContext } from '@/contexts/AuthContext';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';
import { cn } from '@/lib/utils';
import { readLayouts } from '../readLayouts';
import DashboardAnalysis from '../Components/DashboardAnalysis';
import DashboardDeleteDialog from '../Components/DashboardDeleteDialog';
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { userState } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [dashboardInfo, setDashboardInfo] = useState(defaultDashboardInfo); // dashboard 정보
  const [assistantOpen, setAssistantOpen] = useState(false);
  const dashboardRequest = useRef(0);
  const blockedDashboardId = useRef<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const managementScope = personalLibrarySessionScope();
  const [ownerManagement, setOwnerManagement] = useState<{ dashboardId: number; scope: string } | null>(null);
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
    const request = dashboardRequest.current;
    setInsightLoading(true);
    AiService.dashboardInsight(dashboardId)
      .then(response => {
        if (request !== dashboardRequest.current) return;
        if (response.data.status === STATUS.SUCCESS) {
          setInsight(response.data.data.insight);
        } else {
          alert.error(response.data.message || t('dashboard.insightFailed'));
        }
      })
      .catch(error => {
        if (request !== dashboardRequest.current) return;
        alert.error(error.message);
      })
      .finally(() => {
        if (request !== dashboardRequest.current) return;
        setInsightLoading(false);
      });
  };

  useEffect(() => {
    blockedDashboardId.current = null;
    setPermissionDenied(false);
    setInsight(null);
    setInsightLoading(false);
    setDashboardInfo(defaultDashboardInfo);
    setLayout([]);
    setShareLimitDate(null);
  }, [dashboardId]);

  // init useEffect
  useEffect(() => {
    return getDashboardInfo(dashboardId);
  }, [dashboardId, isShareOn]);

  // A refused content read does not prove ownership was lost. This protected endpoint
  // authorizes current-owner management without exposing the source-backed dashboard.
  useEffect(() => {
    setOwnerManagement(null);
    if (!permissionDenied || !managementScope || blockedDashboardId.current !== dashboardId) return;
    const controller = new AbortController();
    let current = true;
    fetchDashboardDeleteImpact(Number(dashboardId), controller.signal)
      .then(() => {
        if (current && !controller.signal.aborted && personalLibrarySessionScope() === managementScope)
          setOwnerManagement({ dashboardId: Number(dashboardId), scope: managementScope });
      })
      .catch(() => undefined);
    return () => {
      current = false;
      controller.abort();
    };
  }, [permissionDenied, dashboardId, managementScope]);

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
    if (blockedDashboardId.current === id) return () => undefined;
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
      .catch(error => {
        if (request !== dashboardRequest.current) return;
        setDashboardInfo(defaultDashboardInfo);
        setLayout([]);
        if (error?.response?.status === 403) {
          blockedDashboardId.current = id;
          dashboardRequest.current += 1;
          setPermissionDenied(true);
          setRefreshIntervalSec(0);
          setAssistantOpen(false);
          setInsight(null);
          setInsightLoading(false);
          setDeleteOpen(false);
          return;
        }
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
        <div key={item.id} className="h-full w-full overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <WidgetWrapper widgetOption={item} dataSetId={item.datasetId} size={dashboardInfo.layout[index]?.w} />
        </div>
      );
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

  const handleDeleted = (receipt: DashboardDeleteReceipt) => {
    void queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    if (receipt.dashboardId === Number(dashboardId)) navigate('/dashboard', { replace: true });
    snackbar.success(t('dashboard.deleted'));
  };

  if (permissionDenied) {
    return (
      <PageTitleBox
        upperTitle={t('dashboard.view')}
        upperTitleLink="/dashboard"
        title={t('dashboard.view')}
        className="w-full min-w-0 flex-auto p-0 py-6"
      >
        <Seo title={t('dashboard.view')} />
        <Notice severity="error">
          현재 이 대시보드를 볼 권한이 없습니다. 소유권 또는 접근 권한이 변경되었을 수 있습니다.
        </Notice>
        {ownerManagement?.dashboardId === Number(dashboardId) && ownerManagement.scope === managementScope && (
          <>
            <Button variant="outline" className="mt-3" onClick={() => setDeleteOpen(true)}>
              삭제 영향 확인
            </Button>
            <DashboardDeleteDialog
              target={{ id: Number(dashboardId), title: '' }}
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              onDeleted={handleDeleted}
            />
          </>
        )}
      </PageTitleBox>
    );
  }

  return (
    <PageTitleBox
      upperTitle={t('dashboard.view')}
      upperTitleLink="/dashboard"
      title={t('dashboard.view')}
      className="w-full min-w-0 flex-auto p-0 py-6"
    >
      <>
        <Seo title={dashboardInfo.title} />
        <DashboardDeleteDialog
          target={{ id: Number(dashboardId), title: dashboardInfo.title }}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={handleDeleted}
        />
        <div className={cn('min-w-0', assistantOpen ? 'w-full lg:w-[calc(100%-400px)]' : 'w-full')}>
          <PageViewBox
            preserveChildren
            title={dashboardInfo.title}
            date={dateData(dashboardInfo.updatedAt)}
            button={
              <div className="contents">
                <div className="hidden sm:contents">
                  <Select value={String(refreshIntervalSec)} onValueChange={value => setRefreshIntervalSec(Number(value))}>
                    <SelectTrigger
                      size="sm"
                      aria-label={t('dashboard.autoRefresh')}
                      className="w-auto shrink-0 bg-background"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('dashboard.autoRefreshOff')}</SelectItem>
                      <SelectItem value="15">{t('dashboard.sec15')}</SelectItem>
                      <SelectItem value="30">{t('dashboard.sec30')}</SelectItem>
                      <SelectItem value="60">{t('dashboard.min1')}</SelectItem>
                      <SelectItem value="300">{t('dashboard.min5')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <ReloadButton
                    aria-label={t('dashboard.refresh')}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRefreshClick();
                    }}
                  />
                  <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
                    <RouterLink
                      aria-label={t('dashboardModify.edit')}
                      to={`/dashboard/modify?id=${dashboardId}&name=${dashboardInfo.title}`}
                    >
                      <SquarePen />
                    </RouterLink>
                  </Button>
                  <DeleteButton
                    aria-label={t('dashboard.delete')}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDeleteOpen(true);
                    }}
                  />
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <RouterLink to={`/dashboard/${dashboardId}/edit-charts`}>차트·배치 편집</RouterLink>
                </Button>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <RouterLink to={`/dashboard/${dashboardId}/reuse`}>복제해서 재사용</RouterLink>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <RouterLink to={`/dashboard/${dashboardId}/studio`}>Studio 편집</RouterLink>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsightClick}
                  disabled={insightLoading}
                  className="shrink-0 bg-background whitespace-nowrap"
                >
                  {insightLoading ? t('dashboard.insightLoading') : t('dashboard.insight')}
                </Button>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <RouterLink to={`/dashboard/${dashboardId}/publication`}>게시 버전</RouterLink>
                </Button>
                <ShareButton
                  handleShareToggle={handleShareToggle}
                  isShareOn={isShareOn}
                  shareId={dashboardInfo.uuid}
                  dashboardId={dashboardId}
                  shareLimitDate={shareLimitDate}
                  setShareLimitDate={setShareLimitDate}
                  className="h-8"
                />
              </div>
            }
          >
            {insight && (
              <div className="mx-4 mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:mx-6 sm:p-5">
                <p className="mb-1.5 text-sm font-semibold text-primary">{t('dashboard.aiInsight')}</p>
                <p className="text-sm leading-6 whitespace-pre-wrap text-foreground">{insight}</p>
              </div>
            )}
            <div className="min-w-0 flex-auto rounded-b-md bg-muted/30">
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
            </div>
          </PageViewBox>
        </div>
      </>
    </PageTitleBox>
  );
};

export default DashboardView;
