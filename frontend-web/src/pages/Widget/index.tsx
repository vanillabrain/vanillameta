import React, { useContext, useEffect } from 'react';
import { Link as RouterLink, Outlet, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import WidgetService from '@/api/widgetService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingContext } from '@/contexts/LoadingContext';
import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Stack, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/system';
import { STATUS } from '@/constant';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';

const Widget = () => {
  const { t } = useTranslation();
  const title = t('common.widget');
  const { widgetId } = useParams();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  const {
    data: widgetList = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['widgets'],
    queryFn: () =>
      WidgetService.selectWidgetList().then(response => {
        if (response.data.status !== STATUS.SUCCESS) {
          throw new Error('widget list fetch failed');
        }
        return response.data.data;
      }),
    retry: false,
  });
  const noData = widgetList.length === 0;

  useEffect(() => {
    if (isFetching) showLoading();
    else hideLoading();
  }, [isFetching]);

  useEffect(() => {
    if (isError) alert.error(t('widget.loadFailed'));
  }, [isError]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => WidgetService.deleteWidget(id),
    onSuccess: response => {
      if (response.status === 200) {
        queryClient.invalidateQueries({ queryKey: ['widgets'] });
        snackbar.success(t('widget.deleted'));
      } else {
        alert.error(t('widget.deleteFailed'));
      }
    },
  });

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

  const removeWidget = (id, title) => {
    alert.success(
      <Box sx={{ span: { fontWeight: 600 } }}>
        <span>{title}</span>
        <br />
        {t('widget.deleteConfirm')}
      </Box>,
      {
        title: t('widget.deleteTitle'),
        closeCopy: t('data.cancel'),
        actions: [
          {
            copy: t('data.delete'),
            onClick: () => deleteMutation.mutate(id),
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
          <GTSpan>{t('list.name')}</GTSpan>
          <GTSpan>{t('list.modifiedAt')}</GTSpan>
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
            {t('list.noWidget')}
            {matches ? ' ' : <br />}
            {t('list.createWidgetHint')}
          </span>
        </Box>
      </>
    );
  };

  return (
    <Stack sx={{ width: '100%', height: '100%', flex: '1 1 auto' }}>
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
              {t('widget.create')}
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
