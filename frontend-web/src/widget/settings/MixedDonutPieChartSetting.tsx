import React, { useEffect } from 'react';
import { Grid, InputAdornment, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST } from '@/constant';
import { getAggregationDataForChart, getColorArr } from '@/widget/modules/utils/chartUtil';
import TextFieldForm from '@/components/form/TextFieldForm';
import ColorFieldReForm from '@/components/form/ColorFieldReForm';

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

const MixedDonutPieChartSetting = props => {
  const { option, setOption, spec, dataSet } = props;

  console.log(option);

  const getColor = prop => {
    let pieAggrData = [];
    if (option[prop].field) {
      pieAggrData = getAggregationDataForChart(dataSet, option[prop].name, option[prop].field, option[prop].aggregation);
    }
    const colorArr = getColorArr(option[prop].field, pieAggrData.length);
    console.log(colorArr);
    setOption(prevState => {
      prevState[prop].color = colorArr;
      return { ...prevState };
    });
  };

  useEffect(() => {
    getColor('pie');
  }, [option.pie.field, option.pie.name]);

  useEffect(() => {
    getColor('series');
  }, [option.series.field, option.series.name]);

  // const handleSeriesChange = (event, prop) => {
  //   setOption(prevState => ({
  //     ...prevState,
  //     [prop]: {
  //       ...prevState[prop],
  //       [event.target.name]: event.target.value,
  //     },
  //   }));
  // };

  const handleRadiusChange = (event, prop) => {
    setOption(prevState => {
      const obj = { ...prevState };
      // radius가 배열일 때
      if (Array.isArray(obj[prop].radius)) {
        const index = Number(event.target.name.slice(-1)) - 1;
        obj[prop].radius[index] = event.target.value + '%';
        return obj;
      }
      // radius가 문자일 때
      if (typeof obj[prop].radius === 'string') {
        obj[prop].radius = event.target.value + '%';
        return obj;
      }
      return;
    });
  };

  const handleColorChange = (event, index, prop) => {
    // console.log('event', event, index);
    const newOption = { ...option };
    newOption[prop].color.splice(index, 1, event.target.value);
    setOption({ ...option, ...newOption });
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <StyledList>
        <ListItem divider>
          <ListItemText primary="도넛형 차트 시리즈 설정" />
          <SelectForm
            required={true}
            id="name"
            name="name"
            label="이름"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.map(item => item.columnName)}
            value={option.series.name}
            onChange={event => handleSeriesChange(event, setOption, 'series', 'name')}
          />
          <SelectForm
            required={true}
            id="field"
            name="field"
            label="필드"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            value={option.series.field}
            onChange={event => handleSeriesChange(event, setOption, 'series', 'field')}
          />
          <SelectForm
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            optionList={AGGREGATION_LIST}
            value={option.series.aggregation}
            onChange={event => handleSeriesChange(event, setOption, 'series', 'aggregation')}
            disabledDefaultValue
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="도넛형 차트 모양 설정" />
          <TextFieldForm
            id="radius1"
            name="radius1"
            label="내부 원 크기"
            type="number"
            value={option.series.radius[0].slice(0, -1)}
            onChange={event => handleRadiusChange(event, 'series')}
            endAdornment={<InputAdornment position="end">%</InputAdornment>}
          />
          <TextFieldForm
            id="radius2"
            name="radius2"
            label="외부 원 크기"
            type="number"
            value={option.series.radius[1].slice(0, -1)}
            onChange={event => handleRadiusChange(event, 'series')}
            endAdornment={<InputAdornment position="end">%</InputAdornment>}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="도넛형 차트 색상 설정" />
          {option.series.field &&
            option.series.color.map((item, index) => (
              <React.Fragment key={index}>
                <ColorFieldReForm
                  color={item}
                  onChange={event => handleColorChange(event, index, 'series')}
                  setOption={setOption}
                />
              </React.Fragment>
            ))}
        </ListItem>

        <ListItem divider>
          <ListItemText primary="원형 차트 시리즈 설정" />
          <SelectForm
            required={true}
            id="name"
            name="name"
            label="이름"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.map(item => item.columnName)}
            value={option.pie.name}
            onChange={event => handleSeriesChange(event, setOption, 'pie', 'name')}
          />
          <SelectForm
            required={true}
            id="field"
            name="field"
            label="필드"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            value={option.pie.field}
            onChange={event => handleSeriesChange(event, setOption, 'pie', 'field')}
          />
          <SelectForm
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            optionList={AGGREGATION_LIST}
            value={option.pie.aggregation}
            onChange={event => handleSeriesChange(event, setOption, 'pie', 'aggregation')}
            disabledDefaultValue
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="원형 차트 모양 설정" />
          <TextFieldForm
            id="radius"
            name="radius"
            label="크기"
            type="number"
            value={option.pie.radius.slice(0, -1)}
            onChange={event => handleRadiusChange(event, 'pie')}
            endAdornment={<InputAdornment position="end">%</InputAdornment>}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="원형 차트 색상 설정" />
          {option.pie.field &&
            option.pie.color.map((item, index) => (
              <React.Fragment key={index}>
                <ColorFieldReForm
                  color={item}
                  onChange={event => handleColorChange(event, index, 'pie')}
                  setOption={setOption}
                />
              </React.Fragment>
            ))}
        </ListItem>

        <ListItem>
          <ListItemText>범례 설정</ListItemText>
          <SelectForm
            id="legendPosition"
            name="legendPosition"
            label="위치"
            optionList={LEGEND_LIST}
            value={option.legendPosition}
            onChange={event => handleChange(event, setOption)}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default MixedDonutPieChartSetting;
