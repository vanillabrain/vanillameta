import React, { useEffect, useState } from 'react';
import { Grid, List, ListItem, ListItemText, styled, TextField, Button } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorFieldForm from '@/components/form/ColorFieldForm';

const StyledList = styled(List)({
  display: 'flex',
  flexWrap: 'wrap',
  '& .MuiListItemText-root': {
    width: '100%',
  },
  '& .MuiListItemText-primary': {
    mb: 1,
    textAlign: 'left',
    fontWeight: 500,
    fontSize: 14,
  },
  '& .MuiListItem-root': {
    display: 'flex',
    flexDirection: ' column',
    rowGap: 8,
    width: '100%',
    padding: '30px 0 30px',
  },
});

const LineChartSetting = props => {
  const { option, setOption, dataSet } = props;
  const [typeOption, setTypeOption] = useState({ number: [], string: [] });

  // data 성격에 따라 분류하기
  // 1. X축: string, 날짜,
  // 2. series: number

  useEffect(() => {
    const numKeys = [''];
    const strKeys = [''];
    const keys = Object.keys(dataSet[0]);

    // dataSet의 배열을 순회하며 keys 요소들을 프로퍼티 key로 가지는 값들의 타입 확인
    for (let i = 0; i < keys.length; i++) {
      const rel = dataSet.map(item => item[keys[i]]);
      if (rel.every(value => typeof value === 'number')) {
        numKeys.push(keys[i]);
      } else {
        strKeys.push(keys[i]);
      }
    }

    setTypeOption({ number: numKeys, string: strKeys });
  }, [dataSet]);

  const strOption = typeOption.string.map(item => ({ value: item, label: item }));
  const numOption = typeOption.number.map(item => ({ value: item, label: item }));

  const handleChange = event => {
    setOption({ ...option, [event.target.name]: event.target.value });
  };

  const handleAddClick = event => {
    console.log('click');
  };

  return (
    <Grid item xs={10} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <TextField
        id="title"
        name="title"
        label="위젯 이름"
        placeholder="위젯의 이름을 입력해 주세요"
        required
        // autoFocus
        fullWidth
        sx={{ mt: { xs: 5, md: 0 } }}
        // ref={register}
        //{...register('example')}
        value={option.title}
        onChange={handleChange}
      />
      {/*{errors.exampleRequired && <span>This field is required</span>}*/}
      {/*<input type="submit" />*/}
      <StyledList>
        {/*<ListItemText primary="오른쪽 선택 상자" />*/}
        <ListItem divider>
          <SelectForm
            id="xField"
            name="xField"
            label="X축"
            option={strOption}
            value={option.xField}
            onChange={handleChange}
          />
          <SelectForm
            id="yField"
            name="yField"
            label="Y축"
            option={[{ value: 'count', label: 'count' }]}
            value={option.yField}
            onChange={handleChange}
          />
        </ListItem>
        <ListItem divider>
          <SelectForm
            id="series1"
            name="series1"
            label="series1"
            option={numOption}
            value={option.series1}
            onChange={handleChange}
            color
          />
          <SelectForm
            // id="series1Aggregation"
            // name="series1Aggregation"
            label=" "
            // option={[
            //   { value: 'sum', label: '합계' },
            //   { value: 'avg', label: '평균' },
            //   { value: 'max', label: '최대' },
            //   { value: 'min', label: '최소' },
            // ]}
            // value={option.series1Aggregation}
            value={''}
            // onChange={handleChange}
          />
          {/*<ColorFieldForm />*/}
          <SelectForm
            id="series2"
            name="series2"
            label="series2"
            option={numOption}
            value={option.series2}
            onChange={handleChange}
            color
          />
          <SelectForm
            // id="series2Aggregation"
            // name="series2Aggregation"
            label=" "
            // option={[
            //   { value: 'sum', label: '합계' },
            //   { value: 'avg', label: '평균' },
            //   { value: 'max', label: '최대' },
            //   { value: 'min', label: '최소' },
            // ]}
            // value={option.series2Aggregation}
            value={''}
            // onChange={handleChange}
          />
          {/*<ColorFieldForm />*/}
          <Button onClick={handleAddClick}>추가</Button>
        </ListItem>
        <ListItem>
          <SelectForm
            id="legendPosition"
            name="legendPosition"
            label="legend 방향"
            option={[
              { value: 'left', label: '왼쪽' },
              { value: 'right', label: '오른쪽' },
              { value: 'top', label: '위쪽' },
              { value: 'bottom', label: '아래쪽' },
            ]}
            value={option.legendPosition}
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default LineChartSetting;
