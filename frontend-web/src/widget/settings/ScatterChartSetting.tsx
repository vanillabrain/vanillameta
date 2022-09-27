import React from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import TextFieldForm from '@/components/form/TextFieldForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleChange, handleSeriesChange, handleAddClick, handleRemoveClick } from '@/widget/utils/handler';

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

const LineChartSetting = props => {
  const { option, setOption, seriesItem } = props;

  // props로부터 받기 ------------------------------------
  const typeOption = { series: ['high', 'low', 'avg'], axis: ['name', 'color'] }; // series type
  // ----------------------------------------------------

  const legendList = { value: ['left', 'right', 'top', 'bottom'], label: ['왼쪽', '오른쪽', '위쪽', '아래쪽'] };

  // 컴포넌트 별 default series
  const defaultSeries = {
    name: '',
    xField: '',
    yField: '',
    color: '',
    symbolSize: 20,
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={event => handleChange(event, setOption)} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />
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
              <TextFieldForm
                id={`name${index + 1}`}
                name={`name${index + 1}`}
                label={`필드 ${index + 1} 이름`}
                value={item.name}
                onChange={event => handleSeriesChange(event, setOption)}
                endButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
              />
              <SelectForm
                required={true}
                id={`xField${index + 1}`}
                name={`xField${index + 1}`}
                label={`X축`}
                optionList={typeOption.series}
                value={item.xField}
                onChange={event => handleSeriesChange(event, setOption)}
              />
              <SelectForm
                required={true}
                id={`yField${index + 1}`}
                name={`yField${index + 1}`}
                label={`Y축`}
                optionList={typeOption.series}
                value={item.yField}
                onChange={event => handleSeriesChange(event, setOption)}
              />
              <TextFieldForm
                id={`symbolSize${index + 1}`}
                name={`symbolSize${index + 1}`}
                label={`사이즈`}
                type="number"
                value={item.symbolSize}
                onChange={event => handleSeriesChange(event, setOption)}
                endButton={
                  0 < index ? (
                    <RemoveButton onClick={event => handleRemoveClick(event, index, option, setOption)} id={index} />
                  ) : (
                    false
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
                />
              )}
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
            onChange={event => handleChange(event, setOption)}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default LineChartSetting;
