import React, { useEffect, useState } from 'react';
import {
  Grid,
  List,
  ListItem,
  ListItemText,
  styled,
  TextField,
  IconButton,
  IconButtonProps,
  SvgIcon,
  Divider,
} from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import ColorFieldForm from '@/components/form/ColorFieldForm';

const StyledList = styled(List)({
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  '& .MuiListItemText-root': {
    width: '100%',
    marginBottom: 10,
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

const PieChartSetting = props => {
  const { option, setOption } = props;

  // props로부터 받기 ------------------------------------
  const typeOption = { series: ['high', 'low', 'avg'], label: ['name', 'color'] }; // series type
  const dataLength = 12; // color length
  const dataLabel = ['jan', 'fab', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']; // color label
  // ----------------------------------------------------

  const aggregationList = { value: ['sum', 'avg', 'max', 'min'], label: ['합계', '평균', '최대', '최소'] };
  const legendList = { value: ['left', 'right', 'top', 'bottom'], label: ['왼쪽', '오른쪽', '위쪽', '아래쪽'] };

  // select input의 option list를 생성
  const getDropList = (list: any[] | { value: any[]; label: any[] }) => {
    let dropList;
    if (Array.isArray(list)) {
      // value와 label이 같을 경우 배열
      const arr = list.map(item => ({ value: item, label: item }));
      dropList = arr;
    } else {
      // value와 label이 다를 경우 객체
      const value = list.value; // ['sum', 'avg']
      const label = list.label; // ['합계', '평균']
      const arr = value.map((item, index) => ({ value: item, label: label[index] }));
      dropList = arr;
    }
    dropList.unshift({ value: '', label: '선택 안함' });
    return dropList;
  };

  // color 생성
  const getColor = () => {
    const defaultColor = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];
    if (!!option.series.field) {
      return;
    }
    const colorArr = [];
    // defaultColor의 배열을 돌면서 data의 길이만큼 요소를 순서대로 반환
    for (let i = 0; i < dataLength; i++) {
      colorArr.push(defaultColor[i % 9]);
    }
    setOption(prevState => ({
      ...prevState,
      series: { ...prevState.series, color: colorArr },
    }));
  };

  useEffect(() => {
    getColor();
  }, [option.series.field]);

  const handleChange = event => {
    setOption({ ...option, [event.target.name]: event.target.value });
  };

  const handleSeriesChange = event => {
    setOption(prevState => ({
      ...prevState,
      series: {
        ...prevState.series,
        [event.target.name]: event.target.value,
      },
    }));
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <TextField
        id="title"
        name="title"
        label="위젯 이름"
        placeholder="위젯의 이름을 입력해 주세요"
        required
        fullWidth
        sx={{ mt: { xs: 5, md: 0 } }}
        value={option.title}
        onChange={handleChange}
      />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />
          <SelectForm
            id="field"
            name="field"
            label="필드"
            option={getDropList(typeOption.series)}
            value={option.series.field}
            onChange={handleSeriesChange}
          />
          <SelectForm
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            option={getDropList(aggregationList)}
            value={option.series.aggregation}
            onChange={handleSeriesChange}
          />{' '}
          <SelectForm
            id="label"
            name="label"
            label="이름"
            option={getDropList(typeOption.label)}
            value={option.series.label}
            onChange={handleSeriesChange}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="항목 별 색상 설정" />
          {!!option.series.field &&
            option.series.color.map((item, index) => (
              <React.Fragment key={index}>
                <ColorFieldForm
                  id={`color${index + 1}`}
                  name={`color${index + 1}`}
                  value={option.series.color[index]}
                  label={dataLabel}
                  option={option}
                  setOption={setOption}
                  index={index}
                />
                <Divider />
              </React.Fragment>
            ))}
        </ListItem>
        <ListItem>
          <ListItemText>범례 설정</ListItemText>
          <SelectForm
            id="legendPosition"
            name="legendPosition"
            label="위치"
            option={getDropList(legendList)}
            value={option.legendPosition}
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default PieChartSetting;
