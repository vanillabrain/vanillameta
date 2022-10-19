import React, { useEffect, useState } from 'react';
import { Stack } from '@mui/material';
import { useAlert } from 'react-alert';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import WidgetSetting from '@/widget/wrapper/WidgetSetting';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';

const WidgetAttributeSelect = props => {
  const alert = useAlert();

  const { widgetInfo, prevOption, saveWidgetInfo, dataset, isModifyMode = false } = props;

  const [option, setOption] = useState(null);
  const [data, setData] = useState(null);
  const [spec, setSpec] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (dataset || widgetInfo) {
      getData();
    }
  }, [dataset, widgetInfo]);

  useEffect(() => {
    setTitle(widgetInfo.title);
    setOption(JSON.parse(JSON.stringify(widgetInfo.option)));
  }, [widgetInfo]);

  const getData = () => {
    // dataSetId 로 데이터 조회
    // axios.get('/data/sample/chartFull.json').then(response => {
    //   setData(response.data.data);
    //   setSpec(response.data.spec);
    // });
    // DashboardService.selectData(`/data?datasetType=${dataset.datasetType}&datasetId=${dataset.datasetId}`).then(response => {
    DatabaseService.selectData(isModifyMode ? widgetInfo : dataset).then(response => {
      console.log('selectData', response.data);
      if (response.data.status === STATUS.SUCCESS) {
        setData(response.data.data.datas);
        setSpec(response.data.data.fields);
      }
    });
  };

  // 이미 저장된 위젯값이 있는 경우 불러오기
  useEffect(() => {
    if (!!prevOption) {
      setOption({ ...option, ...prevOption });
    }
  }, [prevOption]);

  const handleSubmit = event => {
    event.preventDefault();

    // confirm sample
    alert.success('위젯 속성을 저장하시겠습니까?', {
      title: '위젯 저장',
      closeCopy: '취소',
      actions: [
        {
          copy: '저장',
          onClick: () => {
            saveWidgetInfo(option, title);
          },
        },
      ],
    });
  };

  return (
    <Stack
      direction="row"
      sx={{
        width: '100%',
        height: '100%',
      }}
      onSubmit={handleSubmit}
      id="widgetAttribute"
      component="form"
    >
      <WidgetViewer title={title} widgetType={widgetInfo.componentType} widgetOption={option} dataSet={data} />
      <WidgetSetting
        title={title}
        setTitle={setTitle}
        widgetType={widgetInfo.componentType}
        widgetOption={option}
        setWidgetOption={setOption}
        dataSet={data}
        spec={spec}
      />
    </Stack>
  );
};

export default WidgetAttributeSelect;
