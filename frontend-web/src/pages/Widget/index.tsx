import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import BoardList from '../../components/BoardList';
import AddIconButton from '../../components/button/AddIconButton';

const title = '위젯';

function Widget() {
  const { widget_id } = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);

  useEffect(() => {
    fetch('/data/dummyWidgetList.json')
      .then(response => response.json())
      .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
    setIsLoading(true);
  }, []);

  return (
    <PageContainer>
      {!widget_id ? (
        <PageTitleBox title={title} button={<AddIconButton link="create" />}>
          <BoardList postList={loadedWidgetData} />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Widget;
