import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import BoardList from '../../components/BoardList';

const title = '위젯';
const naviUrl = '/widget/create';

function Widget() {
  const params = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);

  useEffect(() => {
    fetch('data/dummyWidgetList.json')
      .then(response => response.json())
      .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
    setIsLoading(true);
  }, []);

  return (
    <PageContainer>
      {!params.id ? (
        <PageTitleBox title={title} naviUrl={naviUrl}>
          <BoardList postList={loadedWidgetData} url="widget" />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Widget;
