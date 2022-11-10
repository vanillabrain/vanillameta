import React, { useEffect, useState } from 'react';
import { Stack } from '@mui/material';
import DataGrid from '@/components/datagrid';

const TableBoard = props => {
  const { option, dataSet } = props;

  const defaultComponentOption = {
    columns: [],
  };

  const [columns, setColumns] = useState([]);

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      setColumns([...option.columns]);
    }
  }, [option, dataSet]);

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
    <Stack
      sx={{
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
      }}
    >
      <DataGrid
        minBodyHeight={300}
        bodyHeight={'fitToParent'}
        data={dataSet}
        columns={columns}
        columnOptions={{
          resizable: true,
        }}
      />
    </Stack>
  );
};

export default TableBoard;
