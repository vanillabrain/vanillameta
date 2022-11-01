import React from 'react';
import { ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LABEL_LIST } from '@/constant';
import ColorFieldForm from '@/components/form/ColorFieldForm';

const HeatmapChartSetting = props => {
  const { option, setOption, spec } = props;

  console.log(option, 'option');

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary="카테고리 설정" sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          id="xField"
          name="xField"
          label="x축"
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option.xField}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          id="yField"
          name="yField"
          label="y축"
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option.yField}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary="시리즈 설정" />
        <SelectForm
          required={true}
          id="series"
          name="series"
          label="필드"
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label="집계 방식"
          optionList={AGGREGATION_LIST}
          value={option.aggregation}
          onChange={event => handleChange(event, setOption)}
          disabledDefaultValue
        />
        <SelectForm
          name="label"
          label="레이블"
          optionList={LABEL_LIST}
          value={option.label}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem>
        <ListItemText primary="색상 범위 설정" />
        {option.color.map((item, index) => (
          <React.Fragment key={index}>
            <ColorFieldForm
              id={`color${index + 1}`}
              name={`color${index + 1}`}
              value={option.color[index]}
              colorList={option.color}
              setOption={setOption}
              index={index}
            />
          </React.Fragment>
        ))}
      </ListItem>
    </React.Fragment>
  );
};

export default HeatmapChartSetting;
