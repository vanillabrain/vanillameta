import React from 'react';
import ImgCardList from '@/components/ImgCardList';
import TitleBox from '@/components/TitleBox';

function WidgetTypeSelect(props) {
  const { widgetType, setWidgetType, componentList } = props;

  return (
    <TitleBox title="위젯 타입">
      <ImgCardList data={componentList} size="large" selectedType={widgetType} setSelectedType={setWidgetType} />
    </TitleBox>
  );
}

export default WidgetTypeSelect;
