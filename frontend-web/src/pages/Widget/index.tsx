import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, Outlet, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import WidgetService from '@/api/widgetService';
import { LoadingContext } from '@/contexts/LoadingContext';
import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Stack } from '@mui/material';
import { styled } from '@mui/system';

const title = '위젯';

const Widget = () => {
  const { widgetId } = useParams();
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [widgetList, setWidgetList] = useState([]);
  const [noData, setNoData] = useState(false);

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
        setNoData(response.data.data.length == 0);
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
            위젯이 존재하지 않습니다. 위젯을 생성해보세요.
          </span>
        </Box>
      </>
    );
  };

  return (
    <PageContainer>
      {!widgetId ? (
        <PageTitleBox
          title={title}
          button={
            <Button
              variant="contained"
              component={RouterLink}
              to="create"
              sx={{ height: '32px', backgroundColor: '#043f84' }}
              startIcon={<AddIcon />}
            >
              위젯 생성
            </Button>
          }
        >
          {noData ? (
            getEmptyView()
          ) : (
            <>
              <BoardList postList={widgetList} handleDeleteSelect={removeWidget} />
            </>
          )}
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
};

export default Widget;
