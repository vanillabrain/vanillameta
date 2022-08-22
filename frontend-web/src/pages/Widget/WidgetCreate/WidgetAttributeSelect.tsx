import React, { useState, useRef, useEffect } from 'react';
import { Box, Grid, List, ListItem, TextField, styled, ListItemText } from '@mui/material';
import { useForm } from 'react-hook-form';
import SelectForm from '../../../components/form/SelectForm';
import SelectChipForm from '../../../components/form/SelectChipForm';
import RadioForm from '../../../components/form/RadioForm';
import CheckForm from '../../../components/form/CheckForm';
import TextFieldForm from '../../../components/form/TextFieldForm';
import ColorFieldForm from '../../../components/form/ColorFieldForm';

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

function WidgetAttributeSelect(props) {
  // const {
  //   register,
  //   watch,
  //   formState: { errors },
  //   control,
  // } = useForm();

  // console.log(watch('example'));

  const [userValue, setUserValue] = useState({
    widgetName: '',
    value1: '',
    value2: '',
    value3: '',
    value4: '',
    value5: '',
    value6: [],
    value7: [],
    value8: [],
    value9: false,
    value10: '',
    value11: '',
    value12: '',
  });

  const handleChange = event => {
    setUserValue(prevState =>
      event.target.type !== 'checkbox'
        ? { ...prevState, [event.target.name]: event.target.value }
        : { ...prevState, [event.target.name]: event.target.checked },
    );
    props.onUpdate(userValue);
  };

  const handleUpdate = enteredData => {
    setUserValue(prevState => ({ ...prevState, ...enteredData }));
  };

  // const { control, handleSubmit } = useForm({
  //   defaultValues: {
  //     firstName: '',
  //     select: {},
  //   },
  // });
  // const onSubmit = data => {
  //   console.log('data: ', data);
  // };

  return (
    <Grid
      container
      component="form"
      // onSubmit={handleSubmit(onSubmit)}
      id="widgetAttribute"
      sx={{ justifyContent: { xs: 'center', md: 'space-between' } }}
    >
      <Grid item xs={12} md={8.5}>
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </Grid>
      <Grid item xs={10} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
        <TextField
          id="widgetName"
          name="widgetName"
          label="위젯 이름"
          placeholder="위젯의 이름을 입력해 주세요"
          required
          // autoFocus
          fullWidth
          sx={{ mt: { xs: 5, md: 0 } }}
          // ref={register}
          //{...register('example')}
          value={userValue.widgetName}
          onChange={handleChange}
        />
        {/*{errors.exampleRequired && <span>This field is required</span>}*/}
        {/*<input type="submit" />*/}
        <StyledList>
          <ListItem divider>
            <ListItemText primary="꽉 찬 선택 상자" />
            <SelectForm
              id="value1"
              name="value1"
              option={[
                { value: 1, label: '막대형 차트' },
                { value: 2, label: '원형 차트' },
              ]}
              // ref={register}
              //{...register('example')}
              value={userValue.value1}
              onChange={handleChange}
              label={false}
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
              value={userValue.value2}
              onChange={handleChange}
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
              value={userValue.value3}
              onChange={handleChange}
            />
          </ListItem>
          {/*<ListItem divider>*/}
          {/*  <ListItemText primary="컬러피커 오른쪽 선택 상자" />*/}
          {/*  <SelectForm*/}
          {/*    id="value4"*/}
          {/*    name="value4"*/}
          {/*    label="X축"*/}
          {/*    option={[*/}
          {/*      { value: 1, label: 'value1' },*/}
          {/*      { value: 2, label: 'value2' },*/}
          {/*      { value: 3, label: 'value3' },*/}
          {/*      { value: 4, label: 'value4' },*/}
          {/*    ]}*/}
          {/*    value={userValue.value4}*/}
          {/*    onChange={handleChange}*/}
          {/*    color="#fab"*/}
          {/*  />*/}
          {/*  <SelectForm*/}
          {/*    id="value5"*/}
          {/*    name="value5"*/}
          {/*    label="Y축"*/}
          {/*    option={[*/}
          {/*      { value: 1, label: 'value1' },*/}
          {/*      { value: 2, label: 'value2' },*/}
          {/*      { value: 3, label: 'value3' },*/}
          {/*      { value: 4, label: 'value4' },*/}
          {/*    ]}*/}
          {/*    value={userValue.value5}*/}
          {/*    onChange={handleChange}*/}
          {/*    color="#abf"*/}
          {/*  />*/}
          {/*</ListItem>*/}
          <ListItem divider>
            <ListItemText primary="칩 모양 다중 선택 상자" />
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
              value={userValue.value6}
              onChange={handleChange}
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
              value={userValue.value7}
              onChange={handleChange}
              color
            />
          </ListItem>
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
              value={userValue.value8}
              onChange={handleChange}
            />
          </ListItem>
          <ListItem>
            <ListItemText primary="체크박스와 텍스트필드" />
            <CheckForm id="value9" name="value9" label="X축 표시" checked={userValue.value9} onChange={handleChange} />
            <TextFieldForm
              type="text"
              id="value10"
              name="value10"
              label="문자 입력"
              value={userValue.value10}
              onChange={handleChange}
            />
            <TextFieldForm
              type="number"
              id="value11"
              name="value11"
              label="숫자 입력"
              value={userValue.value11}
              onChange={handleChange}
            />
            <ColorFieldForm
              id="value12"
              name="value12"
              label="컬러 입력"
              value={userValue.value12}
              onChange={handleChange}
              onUpdate={handleUpdate}
            />
          </ListItem>
        </StyledList>
      </Grid>
    </Grid>
  );
}

export default WidgetAttributeSelect;
