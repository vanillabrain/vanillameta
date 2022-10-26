import React from 'react';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LABEL_LIST, LEGEND_LIST } from '@/constant';
import ColorPickerForm from '@/components/form/ColorPickerForm';

const CandlestickChartSetting = props => {
  const { option, setOption, spec } = props;
  const candlestickLabel = ['open', 'close', 'lowest', 'highest'];

  return (
    <React.Fragment>
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
        <SelectForm
          name="mark"
          label="마크 포인트"
          optionList={LABEL_LIST}
          value={option.mark}
          onChange={event => handleChange(event, setOption)}
        />
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
    </React.Fragment>
  );
};

export default CandlestickChartSetting;
