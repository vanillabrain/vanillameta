import React from 'react';
import ImgCardList from '@/components/ImgCardList';
import TitleBox from '@/components/TitleBox';

function WidgetTypeSelect(props) {
  const { widgetType, setWidgetType, componentList, handleNext } = props;

  return (
    <TitleBox title="위젯 타입">
      <ImgCardList
        data={componentList}
        size="large"
        selectedType={widgetType}
        setSelectedType={setWidgetType}
        handleNext={handleNext}
      />
    </TitleBox>
  );
}

export default WidgetTypeSelect;
