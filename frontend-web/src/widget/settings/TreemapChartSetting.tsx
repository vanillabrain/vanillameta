import React, { useEffect } from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE } from '@/constant';
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

const TreemapChartSetting = props => {
  const { option, setOption, spec } = props;

  useEffect(() => {
    const colorArr = ['#2F93C8', '#AEC48F', '#FFDB5C', '#F98862'];
    setOption(prevState => ({
      ...prevState,
      series: { ...prevState.series, color: colorArr },
    }));
  }, [option.series.field, option.series.name]);

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
      <WidgetTitleForm value={option.title} onChange={event => handleChange(event, setOption)} />
      <StyledList>
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
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            optionList={AGGREGATION_LIST}
            value={option.series.aggregation}
            onChange={handleSeriesChange}
            disabledDefaultValue
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

export default TreemapChartSetting;
