import React, { useEffect, useState } from 'react';
import DataLayout from '@/pages/Data/DataLayout';

function WidgetDataSelect(props) {
  const { setDataSet, handleNext } = props;

  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState([]);

  useEffect(() => {
    setIsLoading(true);
  }, []);

  // 선택한 데이터베이스를 CardList에서 가져와서 저장하고 dataSet과 dataList를 보여주는 state
  const [presentedData, setPresentedData] = useState({
    dataSource: 0,
    dataList: '',
    dataSet: '',
  });

  const handleUpdate = enteredData => {
    if (typeof enteredData === 'object') {
      setPresentedData(prevState => ({ ...prevState, ...enteredData }));
    }
  };

  useEffect(() => {
    loadedData.filter((item, index) => {
      if (presentedData.dataSource === item.id) {
        const selectedArray = loadedData[index];
        handleUpdate({ dataList: selectedArray.dataList, dataSet: selectedArray.dataSet });
        // console.log(presentedData);
      }
    });
  }, [presentedData.dataSource]);

  return <DataLayout isViewMode={true} setDataSet={setDataSet} />;
}

export default WidgetDataSelect;
