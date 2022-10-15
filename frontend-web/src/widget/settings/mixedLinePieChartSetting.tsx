import React, { useEffect } from 'react';
import { Divider, Grid, InputAdornment, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST, WIDGET_AGGREGATION } from '@/constant';
import ColorFieldForm from '@/components/form/ColorFieldForm';
import { getColorArr } from '@/widget/modules/utils/chartUtil';
import TextFieldForm from '@/components/form/TextFieldForm';

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

const MixedLinePieChartSetting = props => {
  const { option, setOption, seriesItem, axis = 'x', spec, dataSet } = props;

  // 컴포넌트 별 default series
  const defaultSeries = {
    field: '',
    color: '',
    aggregation: WIDGET_AGGREGATION.SUM,
  };

  console.log(option);
  useEffect(() => {
    const colorArr = getColorArr(option.pie.field, dataSet.length);
    console.log(colorArr);
    setOption(
      prevState => {
        prevState.pie.color = colorArr;
        return prevState;
      },
      //     {
      //   ...prevState,
      //   series: { ...prevState.series, color: colorArr },
      // }
    );
  }, [option.series.field, option.series.name, dataSet.length]);

  const handleRadiusChange = (event, prop) => {
    setOption(prevState => {
      const obj = { ...prevState };
      const prop = [...prevState.pie[prop]];
      const index = Number(event.target.name.slice(-1)) - 1;
      prop[index] = event.target.value + '%';
      obj.pie[prop] = prop;
      return obj;
    });
  };

  const handlePieChange = event => {
    setOption(prevState => ({
      ...prevState,
      pie: {
        ...prevState.pie,
        [event.target.name]: event.target.value,
      },
    }));
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <StyledList>
        <ListItem divider>
          <ListItemText primary="선형 차트 카테고리 설정" sx={{ textTransform: 'uppercase' }} />
          <SelectForm
            required={true}
            id={axis + 'Field'}
            name={axis + 'Field'}
            label={axis + '축'}
            optionList={spec.map(item => item.columnName)}
            labelField="columnName"
            valueField="columnType"
            value={option[`${axis}Field`]}
            onChange={event => handleChange(event, setOption)}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="선형 차트 시리즈 설정" />
          <AddButton
            onClick={event => handleAddClick(event, option, setOption, defaultSeries)}
            sx={{
              position: 'absolute',
              top: 30,
              right: 0,
            }}
          />
          {option.series.map((item, index) => (
            <React.Fragment key={index}>
              <SelectForm
                required={true}
                id={`field${index + 1}`}
                name={`field${index + 1}`}
                label={`필드 ${index + 1}`}
                labelField="columnName"
                valueField="columnType"
                optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
                value={item.field}
                onChange={event => handleSeriesChange(event, setOption)}
                endButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
              />
              <SelectForm
                id={`aggregation${index + 1}`}
                name={`aggregation${index + 1}`}
                label="집계 방식"
                optionList={AGGREGATION_LIST}
                value={item.aggregation}
                onChange={event => handleSeriesChange(event, setOption)}
                disabledDefaultValue
                endButton={
                  0 < index ? (
                    <RemoveButton onClick={event => handleRemoveClick(event, index, option, setOption)} id={index} />
                  ) : (
                    ' '
                  )
                }
              />
              {!!seriesItem && (
                <SelectForm
                  id={`${seriesItem.id}${index + 1}`}
                  name={`${seriesItem.name}${index + 1}`}
                  label={seriesItem.label}
                  optionList={seriesItem.optionList}
                  value={item[seriesItem.value]}
                  onChange={event => handleSeriesChange(event, setOption)}
                  disabledDefaultValue={seriesItem.disabledDefaultValue}
                />
              )}
              <Divider />
            </React.Fragment>
          ))}
        </ListItem>
        <ListItem divider>
          <ListItemText primary="원형 차트 시리즈 설정" />
          <SelectForm
            required={true}
            id="field"
            name="field"
            label="필드"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            value={option.pie.field}
            onChange={handlePieChange}
          />
          <SelectForm
            required={true}
            id="name"
            name="name"
            label="이름"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.map(item => item.columnName)}
            value={option.pie.name}
            onChange={handlePieChange}
          />
          <SelectForm
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            optionList={AGGREGATION_LIST}
            value={option.pie.aggregation}
            onChange={handlePieChange}
            disabledDefaultValue
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="원형 차트 위치 설정" />
          <TextFieldForm
            id="radius1"
            name="radius1"
            label="크기"
            type="number"
            value={option.pie.radius.slice(0, -1)}
            onChange={event => handleRadiusChange(event, 'radius')}
            endAdornment={<InputAdornment position="end">%</InputAdornment>}
          />
          <TextFieldForm
            id="center1"
            name="center1"
            label="좌우 위치"
            type="number"
            value={option.pie.center[0].slice(0, -1)}
            onChange={event => handleRadiusChange(event, 'center')}
            endAdornment={<InputAdornment position="end">%</InputAdornment>}
          />
          <TextFieldForm
            id="center2"
            name="center2"
            label="상하 위치"
            type="number"
            value={option.pie.center[1].slice(0, -1)}
            onChange={event => handleRadiusChange(event, 'center')}
            endAdornment={<InputAdornment position="end">%</InputAdornment>}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="원형 차트 색상 항목 설정" />
          {/*  {option.pie.field &&*/}
          {/*    option.pie.color.map((item, index) => (*/}
          {/*      <React.Fragment key={index}>*/}
          {/*        <ColorFieldForm*/}
          {/*          id={`color${index + 1}`}*/}
          {/*          name={`color${index + 1}`}*/}
          {/*          value={option.pie.color[index]}*/}
          {/*          colorList={option.pie.color}*/}
          {/*          setOption={setOption}*/}
          {/*          index={index}*/}
          {/*        />*/}
          {/*        <Divider />*/}
          {/*      </React.Fragment>*/}
          {/*    ))}*/}
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

export default MixedLinePieChartSetting;
