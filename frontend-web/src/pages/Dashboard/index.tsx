import React, { useContext, useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { MenuButton } from '@/components/button/AddIconButton';
import AddIcon from '@mui/icons-material/Add';
import { Box, Stack } from '@mui/material';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { styled } from '@mui/system';
import { LoadingContext } from '@/contexts/LoadingContext';

const title = '대시보드';

function Dashboard() {
  const { dashboardId } = useParams();
  const alert = useAlert();
  const navigate = useNavigate();
  const [loadedDashboardData, setLoadedDashboardData] = useState([]);
  const [noData, setNoData] = useState(false);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const GTSpan = styled('span')({
    fontFamily: 'Pretendard',
    fontSize: '13px',
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
          alert.error('대시보드를 불러올 수 없습니다');
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  const handleDeleteSelect = item => {
    console.log(item);
    alert.success(item.title + '\n삭제하겠습니까?', {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: () => {
            DashboardService.deleteDashboard(item.id).then(response => {
              if (response.data.status == STATUS.SUCCESS) {
                alert.info('삭제되었습니다.', {
                  onClose: () => {
                    getDashboardList();
                  },
                });
              } else {
                alert.error('삭제 실패하였습니다.');
              }
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
          sx={{ paddingLeft: '20px', paddingRight: '217px', marginBottom: '11px', marginTop: '36px' }}
        >
          <GTSpan>이름</GTSpan>
          <GTSpan>수정일</GTSpan>
        </Stack>
        <Box
          sx={{
            height: '57px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexGrow: '0',
            margin: '0 0 0 0',
            borderRadius: '6px',
            border: 'solid 1px #ddd',
            backgroundColor: '#fff',
          }}
        >
          <span
            style={{
              height: '16px',
              flexGrow: 0,
              fontFamily: 'Pretendard',
              fontSize: '16px',
              fontWeight: 600,
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 1,
              letterSpacing: 'normal',
              textAlign: 'center',
              color: '#333333',
            }}
          >
            대시보드가 존재하지 않습니다. 대시보드를 생성해보세요.
          </span>
        </Box>
      </>
    );
  };

  return (
    <PageContainer>
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
