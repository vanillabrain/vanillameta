import React, { useEffect, useState } from 'react';
import {
  Grid,
  List,
  ListItem,
  ListItemText,
  styled,
  TextField,
  IconButton,
  IconButtonProps,
  SvgIcon,
  Divider,
} from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';

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

const DefaultIconButton = icon =>
  styled((props: IconButtonProps) => (
    <IconButton size="small" sx={{ width: '38px', height: '38px' }} {...props}>
      <SvgIcon fontSize="small">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
          {icon}
        </svg>
      </SvgIcon>
    </IconButton>
  ))({ flex: 'none' });

const AddIconButton = DefaultIconButton(
  <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />,
);

const RemoveIconButton = DefaultIconButton(
  <path d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z" />,
);

const LineChartSetting = props => {
  const { option, setOption, axisReverse, ...rest } = props;

  // props로부터 받기 ------------------------------------
  const typeOption = { series: ['high', 'low', 'avg'], [!axisReverse ? 'xField' : 'yField']: ['name', 'color'] }; // series type
  // ----------------------------------------------------

  const aggregationList = { value: ['sum', 'avg', 'max', 'min'], label: ['합계', '평균', '최대', '최소'] };
  const legendList = { value: ['left', 'right', 'top', 'bottom'], label: ['왼쪽', '오른쪽', '위쪽', '아래쪽'] };

  const handleChange = event => {
    setOption({ ...option, [event.target.name]: event.target.value });
  };

  const handleSeriesChange = event => {
    const key = event.target.name.slice(0, -1);
    const index = Number(event.target.name.slice(-1)[0]) - 1;

    setOption(prevState => {
      const tempOption = { ...prevState };

      // onChange 일어난 요소 key와 index로 식별해서 value 주기
      tempOption.series.forEach((item, idx) => {
        console.log('item', item);
        if (index === idx) {
          item[key] = event.target.value;
        }
      });
      return tempOption;
    });
  };

  const handleAddClick = () => {
    setOption(prevState => {
      const tempOption = { ...prevState };
      const defaultColor = [
        '#5470c6',
        '#91cc75',
        '#fac858',
        '#ee6666',
        '#73c0de',
        '#3ba272',
        '#fc8452',
        '#9a60b4',
        '#ea7ccc',
      ];
      const newItem = {
        field: '',
        color: defaultColor[option.series.length % 9],
        aggregation: '',
      };
      tempOption.series.push(newItem);
      return tempOption;
    });
  };

  const handleRemoveClick = (event, index) => {
    if (option.series.length === 1) {
      return;
    }

    setOption(prevState => {
      const obj = { ...prevState };
      obj.series.splice(index, 1);
      return obj;
    });
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={handleChange} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="X축 설정" />
          <SelectForm
            id={!axisReverse ? 'xField' : 'yField'}
            name={!axisReverse ? 'xField' : 'yField'}
            label={!axisReverse ? 'X축' : 'Y축'}
            optionList={typeOption[!axisReverse ? 'xField' : 'yField']}
            value={option[!axisReverse ? 'xField' : 'yField']}
            onChange={handleChange}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />
          <AddIconButton
            onClick={handleAddClick}
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
                optionList={typeOption.series}
                value={item.field}
                onChange={handleSeriesChange}
                colorButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
              />
              <SelectForm
                id={`aggregation${index + 1}`}
                name={`aggregation${index + 1}`}
                label={' '}
                optionList={aggregationList}
                value={item.aggregation}
                onChange={handleSeriesChange}
                colorButton={
                  0 < index ? <RemoveIconButton onClick={event => handleRemoveClick(event, index)} id={index} /> : ' '
                }
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
            optionList={legendList}
            value={option.legendPosition}
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default LineChartSetting;
