import React, { useEffect, useState } from 'react';
import { Stack } from '@mui/material';
import axios from 'axios';
import { useAlert } from 'react-alert';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import WidgetSetting from '@/widget/wrapper/WidgetSetting';

const WidgetAttributeSelect = props => {
  const alert = useAlert();

  const { componentInfo, prevOption, saveWidgetInfo, datasetId } = props;

  const [option, setOption] = useState(null);
  const [data, setData] = useState(null);
  const [spec, setSpec] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    console.log('===== componentInfo ', componentInfo);
    setTitle(componentInfo.title);
    setOption(JSON.parse(JSON.stringify(componentInfo.option)));
  }, [componentInfo]);

  const getData = () => {
    // dataSetId 로 데이터 조회
    axios.get('/data/sample/chartFull.json').then(response => {
      setData(response.data.data);
      setSpec(response.data.spec);
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
        flex: '1 1 auto',
      }}
      onSubmit={handleSubmit}
      id="widgetAttribute"
      component="form"
    >
      <WidgetViewer title={title} widgetType={componentInfo.componentType} widgetOption={option} dataSet={data} />
      <WidgetSetting
        title={title}
        setTitle={setTitle}
        widgetType={componentInfo.componentType}
        widgetOption={option}
        setWidgetOption={setOption}
        dataSet={data}
        spec={spec}
      />
    </Stack>
  );
};

export default WidgetAttributeSelect;
