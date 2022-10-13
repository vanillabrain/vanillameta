import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import AddIconButton from '@/components/button/AddIconButton';
import WidgetService from '@/api/widgetService';

const title = '위젯';

const Widget = () => {
  const { widgetId } = useParams();
  const alert = useAlert();

  const [isLoading, setIsLoading] = useState(false);
  const [widgetList, setWidgetList] = useState([]);

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

  const removeWidget = item => {
    alert.success(`${item.title}\n위젯을 삭제하시겠습니까?`, {
      title: '위젯 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            WidgetService.deleteWidget(item.id).then(response => {
              if (response.status === 200) {
                getWidgetList();
              }
            });
          },
        },
      ],
    });
  };

  return (
    <PageContainer>
      {!widgetId ? (
        <PageTitleBox title={title} button={<AddIconButton link="create" />}>
          <BoardList postList={widgetList} handleDeleteSelect={removeWidget} />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
};

export default Widget;
