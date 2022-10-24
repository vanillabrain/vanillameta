import React, { useContext, useEffect, useState } from 'react';
import { Stack } from '@mui/material';
import { useAlert } from 'react-alert';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import WidgetSetting from '@/widget/wrapper/WidgetSetting';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';

const WidgetAttributeSelect = props => {
  const alert = useAlert();
  const { fixLayout } = useContext(LayoutContext);

  const { widgetOption, prevOption, saveWidgetInfo, dataset, isModifyMode = false, top = 0 } = props;

  const [option, setOption] = useState(null);
  const [data, setData] = useState(null);
  const [spec, setSpec] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    fixLayout(true);
    return () => {
      fixLayout(false);
    };
  }, []);

  useEffect(() => {
    if (dataset || widgetOption) {
      getData();
    }
  }, [dataset, widgetOption]);

  useEffect(() => {
    setTitle(widgetOption.title);
    setOption(JSON.parse(JSON.stringify(widgetOption.option)));
  }, [widgetOption]);

  const getData = () => {
    const param = isModifyMode
      ? { datasetType: widgetOption.datasetType, datasetId: widgetOption.datasetId }
      : { datasetType: dataset.datasetType, datasetId: dataset.id };
    console.log('getData param', param);
    DatabaseService.selectData(param).then(response => {
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
        height: `calc(100% - ${top}px)`,
      }}
      onSubmit={handleSubmit}
      id="widgetAttribute"
      component="form"
    >
      <WidgetViewer title={title} widgetType={widgetOption.componentType} widgetOption={option} dataSet={data} />
      <WidgetSetting
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
