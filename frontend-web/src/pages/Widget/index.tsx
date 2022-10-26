import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, Outlet, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import AddIconButton from '@/components/button/AddIconButton';
import WidgetService from '@/api/widgetService';
import { LoadingContext } from '@/contexts/LoadingContext';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';

const title = '위젯';

const Widget = () => {
  const { widgetId } = useParams();
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [widgetList, setWidgetList] = useState([]);

  useEffect(() => {
    getWidgetList();
  }, []);

  /**
   * 위젯 목록 조회
   */
  const getWidgetList = () => {
    showLoading();
    WidgetService.selectWidgetList()
      .then(response => {
        setWidgetList(response.data.data);
      })
      .finally(() => {
        hideLoading();
      });
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
        <PageTitleBox
          title={title}
          button={
            <Button
              component={RouterLink}
              to={'create'}
              variant="contained"
              startIcon={<AddIcon />}
              color="primary"
              sx={{
                borderRadius: '8px',
                backgroundColor: '#043f84',
                width: '97px',
                height: '32px',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: '20px',
                padding: '7px 0',
                objectFit: 'contain',
                border: 'solid 1px #0f5ab2',
              }}
            >
              <span style={{ height: '20px' }}>위젯 추가</span>
            </Button>
          }
        >
          <BoardList postList={widgetList} handleDeleteSelect={removeWidget} />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
};

export default Widget;
