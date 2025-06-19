import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, Outlet, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
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
import { useTranslation } from 'react-i18next';

const Widget = () => {
  const { widgetId } = useParams();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const { t } = useTranslation(['widget', 'common']);

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
          alert.error(t('common:messages.error'));
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  const removeWidget = (id, title) => {
    alert.success(
      <Box sx={{ span: { fontWeight: 600 } }}>
        <span>{title}</span>
        <br />
        {t('common:messages.confirmDelete')}
      </Box>,
      {
        title: t('widget:title'),
        closeCopy: t('common:actions.cancel'),
        actions: [
          {
            copy: t('common:actions.delete'),
            onClick: () => {
              showLoading();
              WidgetService.deleteWidget(id)
                .then(response => {
                  if (response.status === 200) {
                    getWidgetList();
                    snackbar.success(t('widget:messages.deleted'));
                  } else {
                    alert.error(t('common:messages.error'));
                  }
                })
                .finally(() => {
                  hideLoading();
                });
            },
          },
        ],
      },
    );
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
          <GTSpan>{t('common:table.name')}</GTSpan>
          <GTSpan>{t('common:table.updatedAt')}</GTSpan>
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
            {t('widget:list.empty', '생성한 위젯이 없습니다.')}
            {matches ? ' ' : <br />}
            {t('widget:list.createFirst', '위젯을 생성 후 확인해 보세요.')}
          </span>
        </Box>
      </>
    );
  };

  return (
    <Stack sx={{ width: '100%', height: '100%', flex: '1 1 auto' }}>
      <Seo title={t('widget:title')} />

      {!widgetId ? (
        <PageTitleBox
          title={t('widget:title')}
          button={
            <Button
              variant="contained"
              component={RouterLink}
              to="create"
              sx={{ height: '32px', backgroundColor: '#043f84' }}
              startIcon={<AddIcon />}
            >
              {t('widget:create.title')}
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
    </Stack>
  );
};

export default Widget;
