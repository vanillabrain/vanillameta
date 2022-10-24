import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import { Box } from '@mui/material';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';

const title = '대시보드';

function Dashboard() {
  const { dashboardId } = useParams();
  const alert = useAlert();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadedDashboardData, setLoadedDashboardData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);
  const [dashboardNoData, setDashboardNoData] = useState(false);

  const menuList = [
    { name: '대시보드', link: '/dashboard/create', id: 'dashboard' },
    { name: '대시보드 추천', link: '', id: 'recommend' },
  ];

  useEffect(() => {
    getDashboardList();
    setIsLoading(true);
  }, []);

  // dashboard info 조회
  const getDashboardList = () => {
    DashboardService.selectDashboardList().then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        setLoadedDashboardData(response.data.data.filter((list, idx) => idx <= 10 * loadedCount));
        setDashboardNoData(response.data.data.length == 0);
      } else {
        alert.error('서비스 실패!');
      }
    });
    setIsLoading(true);
  };

  const handleDeleteSelect = item => {
    console.log(item);
    alert.success('삭제하겠습니까?', {
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

  // dashboard 목록이 없을때 보여줄 화면
  const getEmptyDashboard = () => {
    return <Box>대시보드 목록이 없음다!</Box>;
  };

  return (
    <PageContainer>
      {!dashboardId ? (
        <>
          <PageTitleBox
            title={title}
            sx={{ width: '100%' }}
            button={
              <AddMenuIconButton
                menuList={menuList}
                handleSelect={handleMenuSelect}
                iconUrl={'../../assets/images/icon/btn-icon-default.png'}
                sizeOption={{ width: 108, height: 32 }}
              />
            }
          >
            {dashboardNoData ? (
              getEmptyDashboard()
            ) : (
              <>
                <Box sx={{ height: '36px' }} />
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
