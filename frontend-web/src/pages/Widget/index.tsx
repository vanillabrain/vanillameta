import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, Outlet, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import WidgetService from '@/api/widgetService';
import { LoadingContext } from '@/contexts/LoadingContext';
import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Stack, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/system';
import { STATUS } from '@/constant';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';

const title = '위젯';

const Widget = () => {
  const { widgetId } = useParams();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [widgetList, setWidgetList] = useState([]);
  const [noData, setNoData] = useState(false);
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));

  const GTSpan = styled('span')({
    fontFamily: 'Pretendard',
    fontSize: matches ? '13px' : '10px',
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
        if (response.data.status == STATUS.SUCCESS) {
          setWidgetList(response.data.data);
          setNoData(response.data.data.length == 0);
        } else {
          alert.error('위젯 조회에 실패했습니다.\n다시 시도해 주세요.');
        }
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
            showLoading();
            WidgetService.deleteWidget(item.id)
              .then(response => {
                if (response.status === 200) {
                  getWidgetList();
                  snackbar.success('위젯이 삭제되었습니다.');
                } else {
                  alert.error('위젯 삭제에 실패했습니다.\n다시 시도해 주세요.');
                }
              })
              .finally(() => {
                hideLoading();
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
          sx={{ paddingLeft: '20px', paddingRight: { xs: '20px', sm: '217px' }, marginBottom: '11px', marginTop: '36px' }}
        >
          <GTSpan>이름</GTSpan>
          <GTSpan>수정일</GTSpan>
        </Stack>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexGrow: '0',
            py: '18px',
            margin: '0 0 0 0',
            borderRadius: '6px',
            border: 'solid 1px #ddd',
            backgroundColor: '#fff',
          }}
        >
          <span
            style={{
              flexGrow: 0,
              fontFamily: 'Pretendard',
              fontSize: matches ? '16px' : '14px',
              fontWeight: 600,
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 1.43,
              letterSpacing: 'normal',
              textAlign: 'center',
              color: '#333333',
            }}
          >
            생성한 위젯이 없습니다.
            {matches ? ' ' : <br />}
            위젯을 생성 후 확인해 보세요.
          </span>
        </Box>
      </>
    );
  };

  return (
    <PageContainer>
      <Seo title={title} />

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
