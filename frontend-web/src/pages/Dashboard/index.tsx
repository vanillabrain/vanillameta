import React, { useContext, useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { MenuButton } from '@/components/button/AddIconButton';
import AddIcon from '@mui/icons-material/Add';
import { Box, Stack, useMediaQuery, useTheme } from '@mui/material';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { styled } from '@mui/system';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';

const title = '대시보드';

function Dashboard() {
  const { dashboardId } = useParams();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const [loadedDashboardData, setLoadedDashboardData] = useState([]);
  const [noData, setNoData] = useState(false);
  const { showLoading, hideLoading } = useContext(LoadingContext);
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
    { name: '대시보드', link: '/dashboard/create', id: 'dashboard' },
    { name: '대시보드 추천', link: '', id: 'recommend' },
  ];

  useEffect(() => {
    getDashboardList();
  }, []);

  // dashboard info 조회
  const getDashboardList = () => {
    showLoading();
    DashboardService.selectDashboardList()
      .then(response => {
        if (response.data.status == STATUS.SUCCESS) {
          setLoadedDashboardData(response.data.data);
          setNoData(response.data.data.length == 0);
        } else {
          alert.error('대시보드 조회에 실패했습니다.\n다시 시도해 주세요.');
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  const handleDeleteSelect = item => {
    console.log(item);
    alert.success(item.title + '\n대시보드를 삭제하시겠습니까?', {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: () => {
            showLoading();
            DashboardService.deleteDashboard(item.id)
              .then(response => {
                if (response.data.status == STATUS.SUCCESS) {
                  getDashboardList();
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

  const handleMenuSelect = item => {
    console.log(item);
    if (item.id !== undefined) {
      if (item.id == 'dashboard') {
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
          sx={{ paddingLeft: '20px', paddingRight: { xs: '20px', sm: '217px' }, marginBottom: '11px', marginTop: '36px' }}
        >
          <GTSpan>이름</GTSpan>
          <GTSpan>수정일</GTSpan>
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
            생성한 대시보드가 없습니다.
            {matches ? ' ' : <br />}
            대시보드를 생성 후 확인해 보세요.
          </span>
        </Box>
      </>
    );
  };

  return (
    <PageContainer>
      <Seo title={title} />

      {!dashboardId ? (
        <>
          <PageTitleBox
            title={title}
            sx={{ width: '100%' }}
            button={
              <MenuButton
                menuList={menuList}
                handleSelect={handleMenuSelect}
                icon={<AddIcon />}
                title="대시보드 추가"
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
    </PageContainer>
  );
}

export default Dashboard;
