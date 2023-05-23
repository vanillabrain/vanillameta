import React, { useEffect, useRef, useState } from 'react';
import DataGrid, { DataGridWrapper } from '@/components/datagrid';
import _ from 'lodash';

const TableBoard = props => {
  const { option, dataSet } = props;
  const [columns, setColumns] = useState([]);
  const [resizeObserver, setResizeObserver] = useState(null);
  const wrapperRef = useRef(null);

  const defaultComponentOption = {
    columns: [],
  };

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      setColumns([...newOption.columns]);
    }
  }, [option, dataSet]);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      throttleResize(entries);
    });
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  const throttleResize = _.throttle(entries => {
    entries?.forEach(entry => {
      setResizeObserver(entry.contentRect);
    });
  }, 300);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */

  const createComponentOption = () => {
    console.log('option', option);

    return { ...defaultComponentOption, ...option };
  };

  return (
    <DataGridWrapper ref={wrapperRef}>
      <DataGrid
        resizeObserver={resizeObserver}
        minBodyHeight={300}
        bodyHeight={'fitToParent'}
        data={dataSet}
        columns={columns}
        columnOptions={{
          resizable: true,
        }}
      />
    </DataGridWrapper>
  );
};

export default TableBoard;
