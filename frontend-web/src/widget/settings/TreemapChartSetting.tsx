import React from 'react';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST } from '@/constant';
import ColorFieldForm from '@/components/form/ColorFieldForm';
import { handleChange } from '@/widget/utils/handler';

const TreemapChartSetting = props => {
  const { option, setOption, spec } = props;

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
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary="카테고리 설정" sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          required={true}
          id="name"
          name="name"
          label="이름"
          labelField="columnName"
          valueField="columnType"
          optionList={spec.map(item => item.columnName)}
          value={option.series.name}
          onChange={handleSeriesChange}
        />
        <SelectForm
          name="label"
          label="넘버 레이블"
          optionList={DISPLAY_LIST}
          value={option.label}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary="시리즈 설정" />
        <SelectForm
          required={true}
          id="field"
          name="field"
          label="필드"
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series.field}
          onChange={handleSeriesChange}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label="집계 방식"
          optionList={AGGREGATION_LIST}
          value={option.series.aggregation}
          onChange={handleSeriesChange}
          disabledDefaultValue
        />
        <Divider />
      </ListItem>
      <ListItem>
        <ListItemText primary="색상 범위 설정" />
        {option.series.color.map((item, index) => (
          <React.Fragment key={index}>
            <ColorFieldForm
              id={`color${index + 1}`}
              name={`color${index + 1}`}
              value={option.series.color[index]}
              colorList={option.series.color}
              setOption={setOption}
              index={index}
            />
          </React.Fragment>
        ))}
      </ListItem>
    </React.Fragment>
  );
};

export default TreemapChartSetting;
