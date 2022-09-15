import React, { useEffect, useState } from 'react';
import {
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  styled,
  TextField,
  Button,
  IconButton,
  IconButtonProps,
  SvgIcon,
  Divider,
} from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';

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

const AddIconButton = styled((props: IconButtonProps) => (
  <IconButton {...props}>
    <SvgIcon fontSize="small">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
        <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
      </svg>
    </SvgIcon>
  </IconButton>
))({
  position: 'absolute',
  top: 30,
  right: 0,
});

const LineChartSetting = props => {
  const { option, setOption } = props;

  // props로부터 받기
  const typeOption = { series: ['high', 'low', 'avg'], xField: ['name', 'color'] };
  const [addedSeriesLength, setAddedSeriesLength] = useState(1);

  const xFieldDropList = typeOption.xField.map(item => ({ value: item, label: item }));
  const seriesDropList = typeOption.series.map(item => ({ value: item, label: item }));

  const aggregationList = [
    { value: 'sum', label: '합계' },
    { value: 'avg', label: '평균' },
    { value: 'max', label: '최대' },
    { value: 'min', label: '최소' },
  ];
  const legendList = [
    { value: 'left', label: '왼쪽' },
    { value: 'right', label: '오른쪽' },
    { value: 'top', label: '위쪽' },
    { value: 'bottom', label: '아래쪽' },
  ];

  const handleChange = event => {
    setOption({ ...option, [event.target.name]: event.target.value });
  };

  const handleSelectChange = event => {
    const key = event.target.name.slice(0, -1);
    const index = Number(event.target.name.slice(-1)[0]) - 1;

    setOption(prevState => {
      const tempOption = { ...prevState };

      // onChange 일어난 요소 key와 index로 식별해서 value 주기
      tempOption.series.forEach((item, idx) => {
        if (index === idx) {
          item[key] = event.target.value;
        }
      });
      return tempOption;
    });
  };

  const handleAddClick = () => {
    if (addedSeriesLength === typeOption.series.length) {
      return;
    }
    setAddedSeriesLength(prevState => prevState + 1);

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
        color: defaultColor[addedSeriesLength],
        aggregation: '',
      };
      tempOption.series.push(newItem);
      return tempOption;
    });
    console.log(option);
  };

  return (
    <Grid item xs={10} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <TextField
        id="title"
        name="title"
        label="위젯 이름"
        placeholder="위젯의 이름을 입력해 주세요"
        required
        // autoFocus
        fullWidth
        sx={{ mt: { xs: 5, md: 0 } }}
        // ref={register}
        //{...register('example')}
        value={option.title}
        onChange={handleChange}
      />
      {/*{errors.exampleRequired && <span>This field is required</span>}*/}
      {/*<input type="submit" />*/}
      <StyledList>
        <ListItem divider>
          <ListItemText primary="축 설정" />
          <SelectForm
            id="xField"
            name="xField"
            label="X축"
            option={xFieldDropList}
            value={option.xField}
            onChange={handleChange}
          />
          <SelectForm
            id="yField"
            name="yField"
            label="Y축"
            option={[{ value: 'count', label: 'count' }]}
            value={option.yField}
            onChange={handleChange}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="Series 설정" />
          <AddIconButton onClick={handleAddClick} />
          {option.series.map((item, index) => (
            <React.Fragment key={index}>
              <SelectForm
                id={`field${index + 1}`}
                name={`field${index + 1}`}
                label={`Series ${index + 1}`}
                option={seriesDropList}
                value={item.field}
                onChange={handleSelectChange}
                colorButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
              />
              <SelectForm
                id={`aggregation${index + 1}`}
                name={`aggregation${index + 1}`}
                label={' '}
                option={aggregationList.map(item => item)}
                value={item.aggregation}
                onChange={handleSelectChange}
              />
              <Divider />
            </React.Fragment>
          ))}
        </ListItem>
        <ListItem>
          <ListItemText>Legend 설정</ListItemText>
          <SelectForm
            id="legendPosition"
            name="legendPosition"
            label="위치"
            option={legendList.map(item => item)}
            value={option.legendPosition}
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default LineChartSetting;
