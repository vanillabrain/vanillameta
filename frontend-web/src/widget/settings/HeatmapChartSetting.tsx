import React from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE } from '@/constant';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
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

const HeatmapChartSetting = props => {
  const { option, setOption, spec } = props;

  // console.log(option, 'option');

  // 컴포넌트 별 default series
  const defaultSeries = {
    field: '',
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <StyledList>
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
              <Divider />
            </React.Fragment>
          ))}
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default HeatmapChartSetting;
