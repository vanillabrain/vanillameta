import React, { useEffect } from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { COLUMN_TYPE } from '@/constant';
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

  useEffect(() => {
    const colorArr = ['#2F93C8', '#AEC48F', '#FFDB5C', '#F98862'];
    setOption(prevState => ({
      ...prevState,
      series: { ...prevState.series, color: colorArr },
    }));
  }, [option.series.field]);

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={event => handleChange(event, setOption)} />
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
            id="field"
            name="field"
            label="필드"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            value={option.series.field}
            onChange={event => handleSeriesChange(event, setOption, undefined, 'field')}
          />
        </ListItem>
        <ListItem>
          <ListItemText primary="색상 범위 설정" />
          {option.series.color.map((item, index) => (
            <React.Fragment key={index}>
              <ColorFieldForm
                id={`color${index + 1}`}
                name={`color${index + 1}`}
                value={option.series.color[index]}
                optionList={option}
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
