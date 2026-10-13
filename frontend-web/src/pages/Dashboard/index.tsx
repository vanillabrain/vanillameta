import React, { useContext, useEffect, useState } from 'react';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MenuButton } from '@/components/button/AddIconButton';
import AddIcon from '@mui/icons-material/Add';
import { Box, Stack } from '@mui/material';
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
    if (isFetching) showLoading();
    else hideLoading();
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
    { name: 'AI 대시보드 만들기', link: '', id: 'ai' },
    { name: t('nav.dashboard'), link: '/dashboard/create', id: 'dashboard' },
    { name: t('list.recommend'), link: '', id: 'recommend' },
  ];

  const handleDeleteSelect = (id, title) => {
    alert.success(
      <Box sx={{ span: { fontWeight: 600 } }}>
        <span>{title}</span>
        <br />
        {t('dashboard.deleteConfirm')}
      </Box>,
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
    console.log(item);
    if (item.id !== undefined) {
      if (item.id === 'ai') {
        setAiOpen(true);
      } else if (item.id == 'dashboard') {
        navigate('/dashboard/create?createType=dashboard');
      } else {
        navigate('/dashboard/create?createType=recommend');
      }
    }
  };

  return (
    <Stack sx={{ width: '100%', height: '100%', flex: '1 1 auto' }}>
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
        onSaved={id => {
          setAiOpen(false);
          queryClient.invalidateQueries({ queryKey: ['dashboards'] });
          navigate(`/dashboard/${id}`);
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
                icon={<AddIcon />}
                title={t('list.addDashboard')}
                sizeOption={{ width: 108, height: 32 }}
              />
            }
          >
            <GettingStarted returning={!noData} />
            {!noData && (
              <>
                <BoardList postList={loadedDashboardData} handleDeleteSelect={handleDeleteSelect} />
              </>
            )}
          </PageTitleBox>
        </>
      ) : (
        <Outlet />
      )}
    </Stack>
  );
}

export default Dashboard;
