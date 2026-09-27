import { useContext, useEffect, useState } from 'react';
import { Box, Stack } from '@mui/material';
import { useAlert } from 'react-alert';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import WidgetSetting from '@/widget/wrapper/WidgetSetting';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import grid from '@/assets/images/grid.svg';
import { SnackbarContext } from '@/contexts/AlertContext';
import { useIsFetching, useQuery } from '@tanstack/react-query';

const WidgetAttributeSelect = props => {
  const { widgetOption, saveWidgetInfo, dataset, isModifyMode = false, widgetTypeName, widgetTypeDescription } = props;

  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { fixLayout } = useContext(LayoutContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [option, setOption] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    fixLayout(true);
    return () => {
      fixLayout(false);
    };
  }, []);

  useEffect(() => {
    if (widgetOption.title) {
      setTitle(widgetOption.title);
    }
    setOption(JSON.parse(JSON.stringify(widgetOption.option)));
  }, [widgetOption]);

  // 위젯 데이터/스펙 조회
  const dataParam = isModifyMode
    ? { ...widgetOption }
    : dataset
    ? dataset.datasetType === 'TABLE'
      ? { ...dataset }
      : { ...dataset, datasetId: dataset.id }
    : null;

  const { data: dataResponse } = useQuery({
    queryKey: ['widget-data', dataParam],
    queryFn: async () => (await DatabaseService.selectData(dataParam)).data,
    enabled: !!dataParam,
  });

  const data = dataResponse?.status === STATUS.SUCCESS ? dataResponse.data.datas : null;
  const spec = dataResponse?.status === STATUS.SUCCESS ? dataResponse.data.fields : null;

  const fetchingCount = useIsFetching();
  useEffect(() => {
    if (fetchingCount > 0) {
      showLoading();
    } else {
      hideLoading();
    }
  }, [fetchingCount]);

  const handleSubmit = event => {
    event.preventDefault();

    // confirm sample
    alert.success('위젯을 저장하시겠습니까?', {
      title: '위젯 저장',
      closeCopy: '취소',
      actions: [
        {
          copy: '저장',
          onClick: () => {
            saveWidgetInfo(option, title);
            snackbar.success('위젯이 저장되었습니다.');
          },
        },
      ],
    });
  };

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      sx={{
        width: '100%',
        height: isModifyMode ? 'calc(100vh - 170px)' : 'calc(100vh - 245px)', // 170px
        overflow: 'hidden',
        backgroundColor: '#f5f6f8',
        backgroundImage: `url(${grid})`,
        backgroundRepeat: 'repeat',
      }}
      onSubmit={handleSubmit}
      id="widgetAttribute"
      component="form"
    >
      <Box
        sx={{
          width: '60%',
          height: '50vw',
          minHeight: '300px',
          maxHeight: '100%',
          margin: '54px auto',
          border: '1px solid #e2e2e2',
          borderRadius: '8px',
          boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
          backgroundColor: '#fff',
          overflow: 'hidden',
        }}
      >
        <WidgetViewer title={title} widgetType={widgetOption.componentType} widgetOption={option} dataSet={data} />
      </Box>
      <WidgetSetting
        widgetTypeName={widgetTypeName}
        widgetTypeDescription={widgetTypeDescription}
        title={title}
        setTitle={setTitle}
        widgetType={widgetOption.componentType}
        widgetOption={option}
        setWidgetOption={setOption}
        dataSet={data}
        spec={spec}
      />
    </Stack>
  );
};

export default WidgetAttributeSelect;
