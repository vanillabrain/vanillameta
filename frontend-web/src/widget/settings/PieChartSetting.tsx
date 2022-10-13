import React, { useEffect } from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorFieldForm from '@/components/form/ColorFieldForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST } from '@/constant';
import { getColorArr } from '@/widget/modules/utils/chartUtil';

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

const PieChartSetting = props => {
  const { option, setOption, listItem, spec, dataLength } = props;

  useEffect(() => {
    const colorArr = getColorArr(option.series.field, dataLength);
    setOption(prevState => ({
      ...prevState,
      series: { ...prevState.series, color: colorArr },
    }));
  }, [option.series.field, option.series.name, dataLength]);

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
        <ListItem divider>
          <ListItemText primary="색상 항목 설정" />
          {option.series.field &&
            option.series.color.map((item, index) => (
              <React.Fragment key={index}>
                <ColorFieldForm
                  id={`color${index + 1}`}
                  name={`color${index + 1}`}
                  value={option.series.color[index]}
                  colorList={option.series.color}
                  setOption={setOption}
                  index={index}
                />
                <Divider />
              </React.Fragment>
            ))}
        </ListItem>

        {/* 추가되는 아이템 */}
        {!!listItem && (
          <ListItem divider>
            <ListItemText primary={listItem.title} />
            {listItem.children}
          </ListItem>
        )}

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

export default PieChartSetting;
