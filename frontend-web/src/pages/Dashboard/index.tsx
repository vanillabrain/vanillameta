import React, { useState, useEffect } from 'react';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import BoardList from '../../components/BoardList';
import { Outlet, useParams } from 'react-router-dom';
import AddButton from '../../components/button/AddButton';

const title = '대시보드';

function Dashboard(props) {
  const { dashboard_id } = useParams();
  console.log(dashboard_id);

  const [isLoading, setIsLoading] = useState(false);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);

  useEffect(() => {
    fetch('/data/dummyDashboardList.json')
      .then(response => response.json())
      .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
    setIsLoading(true);
  }, []);

  return (
    <PageContainer>
      {!dashboard_id ? (
        <PageTitleBox title={title} button={<AddButton naviUrl="/dashboard/create" />}>
          <BoardList postList={loadedWidgetData} />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Dashboard;
