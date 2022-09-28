import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import { Box } from '@mui/material';
import DashboardService from '@/api/dashboardService';
import { get } from '@/helpers/apiHelper';

const title = '대시보드';

function Dashboard(props) {
  const { dashboard_id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);
  const [dashboardNoData, setDashboardNoData] = useState(false);

  const menuList = [
    { name: '대시보드', link: '/dashboard/create', id: 'dashboard' },
    { name: '대시보드 추천', link: '', id: 'recommend' },
  ];

  useEffect(() => {
    // todo 서비스 완료시 연결
    // DashboardService.selectDashboardList()
    get('/data/dummyDashboardList.json')
      .then(response => response.data)
      .then(data => {
        setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount));
        setDashboardNoData(data.length == 0);
      });
    setIsLoading(true);
  }, []);

  const handleDeleteSelect = item => {
    // todo 삭제 로직 넣기
    console.log('삭제버튼 눌렀다');
    console.log(item);
  };

  const handleMenuSelect = item => {
    console.log('왜 안타');
    console.log(item);
    if (item.id == 'dashboard') {
      navigate('/dashboard/create?create_type=dashboard');
    } else {
      navigate('/dashboard/create?create_type=recommend');
    }
  };

  // dashboard 목록이 없을때 보여줄 화면
  const getEmptyDashboard = () => {
    return <Box>대시보드 목록이 없음다!</Box>;
  };

  return (
    <PageContainer>
      {!dashboard_id ? (
        dashboardNoData ? (
          getEmptyDashboard()
        ) : (
          <>
            <PageTitleBox title={title} button={<AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} />}>
              <BoardList postList={loadedWidgetData} handleDeleteSelect={handleDeleteSelect} />
            </PageTitleBox>
          </>
        )
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Dashboard;
