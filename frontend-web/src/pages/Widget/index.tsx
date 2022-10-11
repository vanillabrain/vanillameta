import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import AddIconButton from '@/components/button/AddIconButton';
import WidgetService from '@/api/widgetService';

const title = '위젯';

const Widget = () => {
  const { widgetId } = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [widgetList, setWidgetList] = useState([]);
  // const [loadedCount, setLoadedCount] = useState(1);

  useEffect(() => {
    getWidgetList();
  }, []);

  /**
   * 위젯 목록 조회
   */
  const getWidgetList = () => {
    // get('/data/dummyWidgetList.json')
    WidgetService.selectWidgetList().then(response => setWidgetList(response.data));
    // .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
    setIsLoading(true);
  };

  return (
    <PageContainer>
      {!widgetId ? (
        <PageTitleBox title={title} button={<AddIconButton link="create" />}>
          <BoardList postList={widgetList} />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
};

export default Widget;
