import React from 'react';
import DataLayout from '@/pages/Data/DataLayout';

function WidgetDataSelect(props) {
  const { setDataSet } = props;

  return <DataLayout isViewMode={true} setDataSet={setDataSet} />;
}

export default WidgetDataSelect;
