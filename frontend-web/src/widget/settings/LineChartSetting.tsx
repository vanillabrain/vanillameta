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
    <IconButton size="small" sx={{ width: '38px', height: '34px' }} {...props}>
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
  const { option, setOption, setIsValid, isSubmit } = props;

  // props로부터 받기 ------------------------------------
  const typeOption = { series: ['high', 'low', 'avg'], xField: ['name', 'color'] }; // series type
  // ----------------------------------------------------

  const aggregationList = { value: ['sum', 'avg', 'max', 'min'], label: ['합계', '평균', '최대', '최소'] };
  const legendList = { value: ['left', 'right', 'top', 'bottom'], label: ['왼쪽', '오른쪽', '위쪽', '아래쪽'] };
  const [addedSeriesLength, setAddedSeriesLength] = useState(1);

  const getDropList = (list: any[] | { value: any[]; label: any[] }) => {
    let dropList;
    if (Array.isArray(list)) {
      // value와 label이 같을 경우 배열
      const arr = list.map(item => ({ value: item, label: item }));
      dropList = arr;
    } else {
      // value와 label이 다를 경우 객체
      const value = list.value; // ['sum', 'avg']
      const label = list.label; // ['합계', '평균']
      const arr = value.map((item, index) => ({ value: item, label: label[index] }));
      dropList = arr;
    }
    dropList.unshift({ value: '', label: '선택 안함' });
    return dropList;
  };

  // validation
  const [isTitleValid, setIsTitleValid] = useState(true);
  // const [checkAttrValid, setCheckAttrValid] = useState({});
  const [invalidSeries, setInvalidSeries] = useState([]);

  const handleChange = event => {
    setOption({ ...option, [event.target.name]: event.target.value });
  };

  const handleSeriesChange = event => {
    const key = event.target.name.slice(0, -1);
    const index = Number(event.target.name.slice(-1)[0]) - 1;

    console.log('index ', index);
    checkSeries(index);

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
  };

  const handleRemoveClick = event => {
    console.log(event.target.id);
    if (addedSeriesLength === 0) {
      return;
    }

    // error state 초기화
    // setCheckAttrValid({});
    // setInvalidSeries;

    setAddedSeriesLength(prevState => prevState - 1);
    setOption(prevState => {
      const tempOption = { ...prevState };
      tempOption.series.pop();
      return tempOption;
    });
  };

  const checkTitle = () => {
    const emptyInput = option.title.trim() === '';
    const overLength = option.title.length > 20;

    if (emptyInput || overLength) {
      setIsTitleValid(false);
      return;
    }
    setIsTitleValid(true);
  };

  const checkSeries = index => {
    option.series.forEach(
      () => {
        setInvalidSeries(prevState => {
          return [...prevState, index];
        });
      }, // valid value 여부
    );
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <TextField
        id="title"
        name="title"
        label="위젯 이름"
        placeholder="위젯의 이름을 입력해 주세요"
        required
        fullWidth
        error={!isTitleValid}
        sx={{ mt: { xs: 5, md: 0 } }}
        value={option.title}
        onBlur={checkTitle}
        onChange={handleChange}
      />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="X축 설정" />
          <SelectForm
            id="xField"
            name="xField"
            label="X축"
            option={getDropList(typeOption.xField)}
            value={option.xField}
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
                id={`field${index + 1}`}
                name={`field${index + 1}`}
                label={`필드 ${index + 1}`}
                option={getDropList(typeOption.series)}
                value={item.field}
                onChange={handleSeriesChange}
                colorButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
                error={invalidSeries.find(item => item === index)}
              />
              <SelectForm
                id={`aggregation${index + 1}`}
                name={`aggregation${index + 1}`}
                label={' '}
                option={getDropList(aggregationList)}
                value={item.aggregation}
                onChange={handleSeriesChange}
                colorButton={0 < index ? <RemoveIconButton onClick={handleRemoveClick} id={index} /> : ' '}
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
            option={getDropList(legendList)}
            value={option.legendPosition}
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default LineChartSetting;
