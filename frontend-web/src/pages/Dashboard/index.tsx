import React, { useState, useEffect } from 'react';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import BoardList from '../../components/BoardList';
import { Outlet, useParams } from 'react-router-dom';
import axios from 'axios';

const title = '대시보드';
const naviUrl = '/dashboard/create';

function Dashboard(props) {
  const params = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);

  useEffect(() => {
    fetch('data/dummyDashboardList.json')
      .then(response => response.json())
      .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
    setIsLoading(true);
  }, []);

  return (
    <PageContainer>
      {!params.id ? (
        <PageTitleBox title={title} naviUrl={naviUrl}>
          <BoardList postList={loadedWidgetData} url="dashboard" />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Dashboard;
