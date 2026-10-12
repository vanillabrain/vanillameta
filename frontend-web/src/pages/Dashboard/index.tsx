import React, { useContext, useEffect, useState } from 'react';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { MenuButton } from '@/components/button/AddIconButton';
import AddIcon from '@mui/icons-material/Add';
import { Box, Stack, useMediaQuery, useTheme } from '@mui/material';
import DashboardService from '@/api/dashboardService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { styled } from '@mui/system';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import AiDashboardPanel from './Components/AiDashboardPanel';

function Dashboard() {
  const { t } = useTranslation();
  const [aiOpen, setAiOpen] = useState(false);
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
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));

  const GTSpan = styled('span')({
    fontFamily: 'Pretendard',
    fontSize: matches ? '13px' : '10px',
    fontWeight: '500',
    fontStretch: 'normal',
    fontStyle: 'normal',
    lineHeight: '1.23',
    letterSpacing: 'normal',
    textAlign: 'left',
    color: '#767676',
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

  // 목록이 없을때 보여줄 화면
  const getEmptyView = () => {
    return (
      <>
        <Stack
          flexDirection="row"
          justifyContent="space-between"
          sx={{ paddingLeft: '20px', paddingRight: { xs: '44px', sm: '217px' }, marginBottom: '11px', marginTop: '36px' }}
        >
          <GTSpan>{t('list.name')}</GTSpan>
          <GTSpan>{t('list.modifiedAt')}</GTSpan>
        </Stack>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexGrow: '0',
            py: '18px',
            margin: '0 0 0 0',
            borderRadius: '6px',
            border: 'solid 1px #ddd',
            backgroundColor: '#fff',
          }}
        >
          <span
            style={{
              fontFamily: 'Pretendard',
              fontSize: matches ? '16px' : '14px',
              fontWeight: 600,
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 1.43,
              letterSpacing: 'normal',
              textAlign: 'center',
              color: '#333333',
            }}
          >
            {t('list.noDashboard')}
            {matches ? ' ' : <br />}
            {t('list.createDashboardHint')}
          </span>
        </Box>
      </>
    );
  };

  return (
    <Stack sx={{ width: '100%', height: '100%', flex: '1 1 auto' }}>
      <Seo title={title} />
      <AiDashboardPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
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
            {noData ? (
              getEmptyView()
            ) : (
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
