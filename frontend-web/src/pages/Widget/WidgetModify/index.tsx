import { useContext, useEffect } from 'react';
import PageTitleBox from '@/components/PageTitleBox';
import { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import widgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';
import { LayoutContext } from '@/contexts/LayoutContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface CustomizedState {
  from: string;
}

const defaultWidgetInfo: WidgetInfo = {
  componentId: '',
  createdAt: '',
  datasetId: '',
  datasetType: '',
  delYn: '',
  description: '',
  id: '',
  option: '',
  title: '',
  updatedAt: '',
  widgetViewId: '',
  icon: '',
  componentTitle: '',
  componentDescription: '',
};

const WidgetModify = () => {
  const [searchParams] = useSearchParams();
  const widgetId = searchParams.get('id');
  const navigate = useNavigate();
  const location = useLocation();
  const { fixLayout } = useContext(LayoutContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    fixLayout(true);
    return () => {
      fixLayout(false);
    };
  }, []);

  // 위젯 조회
  const { data: widgetInfo = defaultWidgetInfo } = useQuery<WidgetInfo>({
    queryKey: ['widget', widgetId],
    queryFn: async () => (await widgetService.selectWidget(String(widgetId))).data.data,
    enabled: !!widgetId,
  });

  // 위젯 저장
  const saveMutation = useMutation({
    mutationFn: ({ id, param }: { id: string; param: any }) => widgetService.updateWidget(id, param),
  });

  const isMutating = saveMutation.isPending;
  const fetchingCount = useIsFetching();
  useEffect(() => {
    if (fetchingCount > 0 || isMutating) {
      showLoading();
    } else {
      hideLoading();
    }
  }, [fetchingCount, isMutating]);

  const saveWidgetInfo = async (option, title) => {
    const param = {
      title: title,
      option: option,
    };
    await saveMutation.mutateAsync({ id: widgetInfo.id, param });
    queryClient.invalidateQueries({ queryKey: ['widgets'] });
    queryClient.invalidateQueries({ queryKey: ['widget', widgetId] });
    navigate((location.state as CustomizedState)?.from || '/widget');
  };

  return (
    <PageTitleBox
      upperTitle="위젯"
      upperTitleLink="/widget"
      title="위젯 편집"
      sx={{ padding: 0 }}
      button={
        <ConfirmButton
          confirmLabel="저장"
          confirmProps={{
            form: 'widgetAttribute',
            type: 'submit',
            variant: 'contained',
          }}
        />
      }
    >
      <WidgetAttributeSelect
        widgetTypeName={widgetInfo.componentTitle}
        widgetTypeDescription={widgetInfo.componentDescription}
        isModifyMode={true}
        dataSetId={widgetInfo.datasetId}
        widgetOption={widgetInfo}
        saveWidgetInfo={saveWidgetInfo}
      />
    </PageTitleBox>
  );
};

export default WidgetModify;
