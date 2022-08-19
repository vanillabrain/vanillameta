import React, { useState, useRef, useEffect, forwardRef } from 'react';
import {
  Box,
  Grid,
  Stack,
  List,
  ListItem,
  TextField,
  SelectChangeEvent,
  styled,
  Button,
  Divider,
  ListItemText,
  Select,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import SelectForm from '../../../components/form/SelectForm';
import SelectChipForm from '../../../components/form/SelectChipForm';
import RadioForm from '../../../components/form/RadioForm';
import CheckForm from '../../../components/form/CheckForm';
import TextFieldForm from '../../../components/form/TextFieldForm';
import ColorFieldForm from '../../../components/form/ColorFieldForm';

function WidgetAttributeSelect(props) {
  const StyledList = styled(List)({
    display: 'flex',
    flexWrap: 'wrap',
    '& .MuiListItemText-root': {
      width: '100%',
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

  // const [userValue, setUserValue] = useState({
  //   widgetName: '',
  //   value1: '',
  //   value2: '',
  //   value3: '',
  //   value4: '',
  //   value5: '',
  //   value6: [],
  //   value7: [],
  //   value8: [],
  //   value9: false,
  //   value10: '',
  //   value11: '',
  //   value12: '',
  // });
  //
  // const handleChange = event => {
  //   setUserValue(prevState =>
  //     event.target.type !== 'checkbox'
  //       ? { ...prevState, [event.target.name]: event.target.value }
  //       : { ...prevState, [event.target.name]: event.target.checked },
  //   );
  //   props.onUpdate(userValue); // data 를 상위 컴포넌트로 전송
  // };
  //
  // const handleUpdate = enteredData => {
  //   setUserValue(prevState => ({ ...prevState, ...enteredData }));
  // };

  // react-hook-form
  const {
    register,
    watch,
    control,
    handleSubmit,
    formState: {},
  } = useForm();

  console.log(watch('widgetName'));

  const onSubmit = data => {
    console.log('data: ', data);
  };

  return (
    <Grid
      container
      component="form"
      onSubmit={handleSubmit(data => console.log(data))}
      id="widgetAttribute"
      sx={{ justifyContent: { xs: 'center', md: 'space-between' } }}
    >
      <Grid item xs={12} md={8.5}>
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </Grid>
      <Grid item xs={10} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
        <button type="submit">submit</button>
        <TextField
          name="widgetName"
          label="위젯 이름"
          placeholder="위젯의 이름을 입력해 주세요"
          required
          autoFocus
          fullWidth
          sx={{ mt: { xs: 5, md: 0 } }}
          // value={userValue.widgetName}
          // onChange={handleChange}
          // ref={register}
          {...register('widgetName')}
        />

        <StyledList>
          <ListItem divider>
            <ListItemText primary="꽉 찬 선택 상자" />
            <SelectForm
              name="value1"
              option={[
                { value: 1, label: '막대형 차트' },
                { value: 2, label: '원형 차트' },
              ]}
              control={control}
              label={false}
              {...register('fullWidthInput')}
              // value={userValue.value1}
              // onChange={handleChange}
            />
          </ListItem>
          <ListItem divider>
            <ListItemText primary="오른쪽 선택 상자" />
            <SelectForm
              id="value2"
              name="value2"
              label="X축"
              option={[
                { value: 1, label: 'value1' },
                { value: 2, label: 'value2' },
                { value: 3, label: 'value3' },
                { value: 4, label: 'value4' },
              ]}
              // value={userValue.value2}
              // onChange={handleChange}
              {...register('halfWidthInput1')}
            />
            <SelectForm
              id="value3"
              name="value3"
              label="Y축"
              option={[
                { value: 1, label: 'value1' },
                { value: 2, label: 'value2' },
                { value: 3, label: 'value3' },
                { value: 4, label: 'value4' },
              ]}
              // value={userValue.value3}
              // onChange={handleChange}
              {...register('halfWidthInput2')}
            />
          </ListItem>
          <ListItem divider>
            <ListItemText primary="컬러피커 오른쪽 선택 상자" />

            <SelectForm
              id="value4"
              name="value4"
              label="X축"
              option={[
                { value: 1, label: 'value1' },
                { value: 2, label: 'value2' },
                { value: 3, label: 'value3' },
                { value: 4, label: 'value4' },
              ]}
              // value={userValue.value4}
              // onChange={handleChange}
              color="#fab"
              {...register('colorPickerSelect1')}
            />
            <SelectForm
              id="value5"
              name="value5"
              label="Y축"
              option={[
                { value: 1, label: 'value1' },
                { value: 2, label: 'value2' },
                { value: 3, label: 'value3' },
                { value: 4, label: 'value4' },
              ]}
              // value={userValue.value5}
              // onChange={handleChange}
              color="#abf"
              {...register('colorPickerSelect2')}
            />
          </ListItem>
          <ListItem divider>
            <ListItemText primary="칩 모양 선택 상자" />
            <SelectChipForm
              id="value6"
              name="value6"
              label="X축"
              option={[
                { value: 1, label: 'value1' },
                { value: 2, label: 'value2' },
                { value: 3, label: 'value3' },
                { value: 4, label: 'value4' },
              ]}
              // value={userValue.value6}
              // onChange={handleChange}
              {...register('chipSelect1')}
            />
            <SelectChipForm
              id="value7"
              name="value7"
              label="Y축"
              option={[
                { value: 1, label: 'value1' },
                { value: 2, label: 'value2' },
                { value: 3, label: 'value3' },
                { value: 4, label: 'value4' },
              ]}
              // value={userValue.value7}
              // onChange={handleChange}
              // color
              {...register('chipSelect2')}
            />
          </ListItem>
          {/*
          <ListItem divider>
            <ListItemText primary="라디오 버튼 선택" />
            <RadioForm
              id="value8"
              name="value8"
              label="범례 방향"
              option={[
                { value: 1, label: '상' },
                { value: 2, label: '하' },
                { value: 3, label: '좌' },
                { value: 4, label: '우' },
              ]}
              // value={userValue.value8}
              // onChange={handleChange}
              {...register('radioSelect')}
            />
          </ListItem>
          <ListItem>
            <ListItemText primary="체크박스와 텍스트필드" />
            <CheckForm
              id="value9"
              name="value9"
              label="X축 표시"
              // checked={userValue.value9} onChange={handleChange}
              {...register('checkboxSelect')}
            />
            <TextFieldForm
              type="text"
              id="value10"
              name="value10"
              label="문자 입력"
              // value={userValue.value10}
              // onChange={handleChange}
              {...register('textInput')}
            />
            <TextFieldForm
              type="number"
              id="value11"
              name="value11"
              label="숫자 입력"
              // value={userValue.value11}
              // onChange={handleChange}
              {...register('numberInput')}
            />
            <ColorFieldForm
              id="value12"
              name="value12"
              label="컬러 입력"
              // value={userValue.value12}
              // onChange={handleChange}
              {...register('colorInput')}
            />
            {/*TODO: TextFieldForm/ColorFieldForm 작동 이상하게 되는거 고치기*/}
          {/*</ListItem>*/}
        </StyledList>
      </Grid>
    </Grid>
  );
}

export default WidgetAttributeSelect;
