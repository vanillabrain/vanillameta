import React, { useContext, useEffect, useState } from 'react';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MenuButton } from '@/components/button/AddIconButton';
import { Plus } from 'lucide-react';
import DashboardService from '@/api/dashboardService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import AiDashboardPanel from './Components/AiDashboardPanel';
import GettingStarted from './Components/GettingStarted';

function Dashboard() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceParam = searchParams.get('aiSourceId') || '';
  const aiSourceId =
    /^[1-9]\d*$/.test(sourceParam) && Number.isSafeInteger(Number(sourceParam)) ? Number(sourceParam) : undefined;
  const [aiOpen, setAiOpen] = useState(!!aiSourceId);
  const title = t('common.dashboard');
  const { dashboardId } = useParams();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  const {
    data: loadedDashboardData = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['dashboards'],
    queryFn: () =>
      DashboardService.selectDashboardList().then(response => {
        if (response.data.status !== STATUS.SUCCESS) {
          throw new Error('dashboard list fetch failed');
        }
        return response.data.data;
      }),
    retry: false,
  });
  const noData = loadedDashboardData.length === 0;

  useEffect(() => {
    if (isFetching) {
      showLoading();
      // A save can navigate away while list invalidation is still fetching.
      return hideLoading;
    }
    hideLoading();
  }, [isFetching]);

  useEffect(() => {
    if (isError) alert.error(t('dashboard.loadFailed'));
  }, [isError]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => DashboardService.deleteDashboard(id),
    onSuccess: response => {
      if (response.data.status == STATUS.SUCCESS) {
        queryClient.invalidateQueries({ queryKey: ['dashboards'] });
        snackbar.success(t('dashboard.deleted'));
      } else {
        alert.error(t('dashboard.deleteFailed'));
      }
    },
  });
  const menuList = [
    { name: 'AI 대시보드 만들기', link: '/studio/new', id: 'ai' },
    { name: t('nav.dashboard'), link: '/dashboard/create', id: 'dashboard' },
    { name: t('list.recommend'), link: '', id: 'recommend' },
  ];

  const handleDeleteSelect = (id, title) => {
    alert.success(
      <div className="[&_span]:font-semibold">
        <span>{title}</span>
        <br />
        {t('dashboard.deleteConfirm')}
      </div>,
      {
        closeCopy: t('data.cancel'),
        actions: [
          {
            copy: t('data.confirm'),
            onClick: () => deleteMutation.mutate(id),
          },
        ],
      },
    );
  };

  const handleMenuSelect = item => {
    if (item.id !== undefined) {
      if (item.id === 'ai') {
        navigate('/studio/new');
      } else if (item.id == 'dashboard') {
        navigate('/dashboard/create?createType=dashboard');
      } else {
        navigate('/dashboard/create?createType=recommend');
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-auto flex-col">
      <Seo title={title} />
      <AiDashboardPanel
        open={aiOpen}
        initialDatabaseId={aiSourceId}
        onClose={() => {
          setAiOpen(false);
          if (searchParams.has('aiSourceId')) {
            const next = new URLSearchParams(searchParams);
            next.delete('aiSourceId');
            setSearchParams(next, { replace: true });
          }
        }}
        onSaved={(id, intent) => {
          setAiOpen(false);
          queryClient.invalidateQueries({ queryKey: ['dashboards'] });
          navigate(
            intent?.publication
              ? `/dashboard/${id}/publication${intent.revision ? `?savedRevision=${intent.revision}` : ''}`
              : `/dashboard/${id}`,
          );
        }}
      />

      {!dashboardId ? (
        <>
          <PageTitleBox
            title={title}
            button={
              <MenuButton
                menuList={menuList}
                handleSelect={handleMenuSelect}
                icon={<Plus />}
                title={t('list.addDashboard')}
                className="h-8 w-[108px]"
              />
            }
          >
            <GettingStarted returning={!noData} />
            {!noData && (
              <>
                <BoardList
                  postList={loadedDashboardData}
                  handleDeleteSelect={handleDeleteSelect}
                  studioHrefForItem={item => (item.analysisDefinition ? `/dashboard/${item.id}/studio` : undefined)}
                />
              </>
            )}
          </PageTitleBox>
        </>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

export default Dashboard;
