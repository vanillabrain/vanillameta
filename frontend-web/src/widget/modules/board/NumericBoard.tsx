import React, { useEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { getAggregationData } from '@/widget/modules/utils/chartUtil';

const NumericBoard = props => {
  const { option, dataSet } = props;

  const defaultComponentOption = {
    header: { title: '제목입니다', fontSize: 16, color: '#cccccc' },
    content: { field: null, aggregation: null, fontSize: 16, color: '#cccccc', prefix: '', suffix: '' },
  };

  const [componentOption, setComponentOption] = useState(defaultComponentOption);
  const [score, setScore] = useState(null);

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      console.log('numericboard new option', newOption);
      setComponentOption(newOption);
    }
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */

  const createComponentOption = () => {
    console.log('option', option);
    const field = option.content.field;
    console.log('field ', field);

    const result = getAggregationData(option.content.aggregation, dataSet, field);

    setScore(option.content.prefix + result + option.content.suffix);
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
      <Typography component="span" sx={{ fontSize: componentOption.header.fontSize, color: componentOption.header.color }}>
        {componentOption.header.title}
      </Typography>
      <Typography component="span" sx={{ fontSize: componentOption.content.fontSize, color: componentOption.content.color }}>
        {score}
      </Typography>
    </Stack>
  );
};

export default NumericBoard;
