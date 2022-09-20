import React, { useEffect } from 'react';
import { Grid, List, ListItem, ListItemText, styled, Divider } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorFieldForm from '@/components/form/ColorFieldForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';

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
      <WidgetTitleForm value={option.title} onChange={handleChange} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />
          <SelectForm
            required={true}
            id="field"
            name="field"
            label="필드"
            optionList={typeOption.series}
            value={option.series.field}
            onChange={handleSeriesChange}
          />
          <SelectForm
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            optionList={aggregationList}
            value={option.series.aggregation}
            onChange={handleSeriesChange}
          />
          <SelectForm
            id="label"
            name="label"
            label="이름"
            optionList={typeOption.label}
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
                  optionList={option}
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
            optionList={legendList}
            value={option.legendPosition}
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default PieChartSetting;
