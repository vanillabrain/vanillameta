import React, { useContext, useEffect } from 'react';
import { Link as RouterLink, Outlet, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import WidgetService from '@/api/widgetService';
import { LoadingContext } from '@/contexts/LoadingContext';
import { STATUS } from '@/constant';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import { Button } from '@/components/ui/button';

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

  const removeWidget = (id, title) => {
    alert.success(
      <>
        <span className="font-semibold">{title}</span>
        <br />
        {t('widget.deleteConfirm')}
      </>,
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
        <div className="mt-9 mb-[11px] flex flex-row justify-between pr-5 pl-5 sm:pr-[217px]">
          <span className="text-left text-[10px] leading-[1.23] font-medium text-muted-foreground sm:text-[13px]">
            {t('list.name')}
          </span>
          <span className="text-left text-[10px] leading-[1.23] font-medium text-muted-foreground sm:text-[13px]">
            {t('list.modifiedAt')}
          </span>
        </div>
        <div className="flex grow-0 items-center justify-center rounded-md border border-border bg-background py-[18px]">
          <span className="text-center text-sm leading-[1.43] font-semibold text-foreground sm:text-base">
            {t('list.noWidget')}
            <br className="sm:hidden" /> {t('list.createWidgetHint')}
          </span>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-full w-full flex-auto flex-col">
      <Seo title={title} />

      {!widgetId ? (
        <PageTitleBox
          title={title}
          button={
            <Button asChild className="h-8 bg-primary">
              <RouterLink to="create">
                <Plus className="size-4" />
                {t('widget.create')}
              </RouterLink>
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
    </div>
  );
};

export default Widget;
