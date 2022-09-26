import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box, Stack, Typography } from '@mui/material';
import { getAggregationData, getGridSize, getLegendOtion } from '@/modules/utils/chartUtil';
import { WIDGET_AGGREGATION } from '@/constant';
import DataGrid from '@/components/DataGrid';

const TableBoard = props => {
  const { option, dataSet } = props;

  const defaultComponentOption = {
    columns: [],
  };

  const [columns, setColumns] = useState([]);

  const [componentOption, setComponentOption] = useState(defaultComponentOption);

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      setComponentOption(newOption);
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
        width: '100%',
        height: '100%',
        padding: 2,
      }}
    >
      <DataGrid
        minBodyHeight={300}
        bodyHeight={500}
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
