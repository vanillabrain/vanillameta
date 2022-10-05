import React from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST } from '@/constant';
import ColorPickerForm from '@/components/form/ColorPickerForm';

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

const CandlestickChartSetting = props => {
  const { option, setOption, spec } = props;
  const candlestickLabel = ['open', 'close', 'lowest', 'highest'];

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={event => handleChange(event, setOption)} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="카테고리 설정" sx={{ textTransform: 'uppercase' }} />
          <SelectForm
            required={true}
            id="xField"
            name="xField"
            label="x축"
            optionList={spec.map(item => item.columnName)}
            labelField="columnName"
            valueField="columnType"
            value={option.xField}
            onChange={event => handleChange(event, setOption)}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />
          {option.series.map((item, index) => (
            <React.Fragment key={index}>
              <SelectForm
                required={true}
                id={`field${index + 1}`}
                name={`field${index + 1}`}
                label={candlestickLabel[index]}
                labelField="columnName"
                valueField="columnType"
                optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
                value={option.series[index].field}
                onChange={event => handleSeriesChange(event, setOption)}
                endButton={
                  <ColorPickerForm
                    name={`color${index + 1}`}
                    color={option.series[index].color}
                    index={index}
                    option={option}
                    setOption={setOption}
                    onChange={event => handleSeriesChange(event, setOption)}
                  />
                }
              />
              <SelectForm
                id={`aggregation${index + 1}`}
                name={`aggregation${index + 1}`}
                label="집계 방식"
                optionList={AGGREGATION_LIST}
                value={item.aggregation}
                onChange={event => handleSeriesChange(event, setOption)}
                disabledDefaultValue
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
            optionList={LEGEND_LIST}
            value={option.legendPosition}
            onChange={event => handleChange(event, setOption)}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default CandlestickChartSetting;
