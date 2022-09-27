import React from 'react';
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
import ColorFieldForm from '@/components/form/ColorFieldForm';
import TextFieldForm from '@/components/form/TextFieldForm';

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
      const obj = { ...prevState };
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
        ...defaultSeries,
        color: defaultColor[option.series.length % 9],
      };
      obj.series.push(newItem);
      return obj;
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
              <TextFieldForm
                id={`name${index + 1}`}
                name={`name${index + 1}`}
                label={`필드 ${index + 1} 이름`}
                value={item.name}
                onChange={handleSeriesChange}
                endButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
              />
              <SelectForm
                required={true}
                id={`xField${index + 1}`}
                name={`xField${index + 1}`}
                label={`X축`}
                optionList={typeOption.series}
                value={item.xField}
                onChange={handleSeriesChange}
              />
              <SelectForm
                required={true}
                id={`yField${index + 1}`}
                name={`yField${index + 1}`}
                label={`Y축`}
                optionList={typeOption.series}
                value={item.yField}
                onChange={handleSeriesChange}
              />
              <TextFieldForm
                id={`symbolSize${index + 1}`}
                name={`symbolSize${index + 1}`}
                label={`사이즈`}
                type="number"
                value={item.symbolSize}
                onChange={handleSeriesChange}
                endButton={
                  0 < index ? <RemoveIconButton onClick={event => handleRemoveClick(event, index)} id={index} /> : false
                }
              />
              {!!seriesItem && (
                <SelectForm
                  id={`${seriesItem.id}${index + 1}`}
                  name={`${seriesItem.name}${index + 1}`}
                  label={seriesItem.label}
                  optionList={seriesItem.optionList}
                  value={item[seriesItem.value]}
                  onChange={handleSeriesChange}
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
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default LineChartSetting;
