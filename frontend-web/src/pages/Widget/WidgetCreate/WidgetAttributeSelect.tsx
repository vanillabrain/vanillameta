import React, { useState, useRef } from 'react';
import {
  Box,
  Grid,
  Stack,
  List,
  ListItem,
  TextField,
  SelectChangeEvent,
  styled,
  Divider,
  ListItemText,
} from '@mui/material';
import SelectForm from '../../../components/form/SelectForm';
import SelectChipForm from '../../../components/form/SelectChipForm';
import RadioForm from '../../../components/form/RadioForm';
import CheckForm from '../../../components/form/CheckForm';
import TextFieldForm from '../../../components/form/TextFieldForm';
import { Style } from '@mui/icons-material';

function WidgetAttributeSelect(props) {
  const [isConnected, setIsConnected] = useState(false);
  const [userSelect, setUserSelect] = useState('');
  const [userSelectColor, setUserSelectColor] = useState('');
  const [userRadio, setUserRadio] = useState('');

  const handleSelectChange = (event: SelectChangeEvent) => {
    setUserSelect(event.target.value as string);
  };
  const handleSelectColorChange = (event: SelectChangeEvent) => {
    setUserSelectColor(event.target.value as string);
  };
  const handleRadioChange = (event: SelectChangeEvent) => {
    setUserRadio(event.target.value as string);
  };

  const handleSubmit = data => {
    data.preventDefault();
    const userData = {
      userSetName: data.target.userSetName.value,
      userSelect: data.target.userSelect.value,
    };
    console.log(userData);
    setIsConnected(true);
  };

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
      // color: '#616161',
    },
    '& .MuiListItem-root': {
      display: 'flex',
      flexDirection: ' column',
      rowGap: 8,
      width: '100%',
      padding: '30px 0 30px',
    },
  });

  return (
    <Grid container component="form" id="widgetAttribute" sx={{ justifyContent: { xs: 'center', md: 'space-between' } }}>
      <Grid item xs={12} md={8.5}>
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </Grid>
      <Grid item xs={10} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
        <TextField
          id="userWidgetName"
          label="위젯 이름"
          placeholder="위젯의 이름을 입력해 주세요"
          required
          autoFocus
          fullWidth
          sx={{ mt: { xs: 5, md: 0 } }}
        />
        <StyledList>
          <ListItem divider>
            <ListItemText primary="꽉 찬 선택 상자" />
            <SelectForm option={['막대형 차트', '원형 차트']} value={userSelect} handleChange={handleSelectChange} />
          </ListItem>
          <ListItem divider>
            <ListItemText primary="오른쪽 선택 상자" />
            <SelectForm
              label="X축"
              option={['value1', 'value2', 'value3']}
              value={userSelect}
              onChange={handleSelectChange}
            />
            <SelectForm
              label="Y축"
              option={['value1', 'value2', 'value3']}
              value={userSelect}
              onChange={handleSelectChange}
            />
          </ListItem>
          <ListItem divider>
            <ListItemText primary="컬러피커 오른쪽 선택 상자" />

            <SelectForm
              label="X축"
              option={['value1', 'value2', 'value3']}
              value={userSelect}
              onChange={handleSelectChange}
              color="#fab"
            />
            <SelectForm
              label="Y축"
              option={['value1', 'value2', 'value3']}
              value={userSelect}
              onChange={handleSelectChange}
              color="#abf"
            />
          </ListItem>
          <ListItem divider>
            <ListItemText primary="칩 모양 선택 상자" />
            <SelectChipForm
              label="X축"
              option={['value1', 'value2', 'value3']}
              value={userSelect}
              onChange={handleSelectChange}
            />
            <SelectChipForm
              label="Y축"
              option={['value1', 'value2', 'value3']}
              value={userSelect}
              onChange={handleSelectChange}
            />
          </ListItem>
          <ListItem divider>
            <ListItemText primary="라디오 버튼 선택" />
            <RadioForm label="범례 방향" option={['상', '하', '좌', '우']} value={userRadio} onChange={handleRadioChange} />
          </ListItem>
          <ListItem>
            <ListItemText primary="체크박스와 텍스트필드" />
            <CheckForm label="X축 표시" />
            <TextFieldForm label="X축 이름" />
          </ListItem>
        </StyledList>

        {/*<StyledList>*/}
        {/*  <ListItem>*/}
        {/*    <SelectForm*/}
        {/*      label="X축"*/}
        {/*      option={['value1', 'value2', 'value3']}*/}
        {/*      value={userSelect}*/}
        {/*      onChange={handleSelectChange}*/}
        {/*    />*/}
        {/*    <SelectForm*/}
        {/*      label="Y축"*/}
        {/*      option={['value1', 'value2', 'value3']}*/}
        {/*      value={userSelect}*/}
        {/*      onChange={handleSelectChange}*/}
        {/*    />*/}
        {/*  </ListItem>*/}
        {/*</StyledList>*/}
        {/*<Divider />*/}
        {/*<StyledList>*/}
        {/*  <ListItem>*/}
        {/*    <RadioForm label="범례 방향" option={['상', '하', '좌', '우']} value={userRadio} onChange={handleRadioChange} />*/}
        {/*  </ListItem>*/}
        {/*</StyledList>*/}
        {/*<Divider />*/}

        {/*<StyledList>*/}
        {/*  <ListItem>*/}
        {/*    <CheckForm label="단위" />*/}
        {/*    <TextFieldForm label="폰트 크기" />*/}
        {/*  </ListItem>*/}
        {/*</StyledList>*/}
        {/*<Divider />*/}

        {/*<StyledList>*/}
        {/*  <ListItem>*/}
        {/*    <SelectForm*/}
        {/*      label="Y축"*/}
        {/*      option={['value1', 'value2', 'value3', 'value4']}*/}
        {/*      value={userSelectColor}*/}
        {/*      color="#fab"*/}
        {/*      onChange={handleSelectColorChange}*/}
        {/*    />*/}
        {/*  </ListItem>*/}
        {/*</StyledList>*/}
      </Grid>
    </Grid>
  );
}

export default WidgetAttributeSelect;
