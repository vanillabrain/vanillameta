import React, { useState } from 'react';
import {
  Box,
  Grid,
  List,
  ListItem,
  Select,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  SelectChangeEvent,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Radio,
  styled,
  ButtonBase,
  IconButton,
} from '@mui/material';
import TitleBox from '../../components/TitleBox';
import PaletteIcon from '@mui/icons-material/Palette';

function WidgetAttributeSelect(props) {
  const data = [
    { key: 1, label: 'X축' },
    { key: 2, label: 'Y축' },
    { key: 3, label: '시리즈1', color: '#abf' },
    { key: 4, label: '시리즈2', color: '#fab' },
  ];

  const [isConnected, setIsConnected] = useState(false);
  const [userValue, setUserValue] = useState('');

  const handleChange = (event: SelectChangeEvent) => {
    setUserValue(event.target.value as string);
  };

  const handleSubmit = data => {
    data.preventDefault();
    // const userData = {
    //   userSetName: data.target.userSetName.value,
    //   userSetContent: data.target.userSetContent.value,
    // };
    // console.log(userData);
    setIsConnected(true);
  };

  return (
    <Stack flexDirection="column" spacing={3}>
      <TitleBox title="위젯 속성 설정" />
      <Grid container component="form" id="widgetAttribute" justifyContent="space-around">
        <Grid item xs={12} md={8}>
          <Box sx={{ width: '100%', height: 500, borderRadius: 1, backgroundColor: '#eee' }} />
        </Grid>
        <Grid item xs={10} md={3}>
          <TextField
            id="userWidgetName"
            label="위젯 이름"
            placeholder="위젯의 이름을 입력해 주세요"
            // required
            autoFocus
            fullWidth
            sx={{ mb: 3, mt: { xs: 5, md: 0 } }}
          />
          <List sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 1 }}>
            {data.map(item => (
              <ListItem key={item.key} sx={{ width: '100%', px: 0 }}>
                <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <FormLabel sx={{ width: '40%' }}>{item.label}</FormLabel>
                  <Stack flexDirection="row" justifyContent="space-between" sx={{ width: '60%' }}>
                    <Select
                      size="small"
                      id="demo-simple-select"
                      value={userValue}
                      onChange={handleChange}
                      sx={item.color ? { width: 'calc(100% - 38px)' } : { width: '100%' }}
                    >
                      <MenuItem value={1}>1</MenuItem>
                      <MenuItem value={2}>2</MenuItem>
                      <MenuItem value={3}>3</MenuItem>
                    </Select>
                    {item.color && (
                      <IconButton aria-label="색상 선택">
                        <PaletteIcon sx={{ color: item.color }} />
                      </IconButton>
                    )}
                  </Stack>
                </FormControl>
              </ListItem>
            ))}
            <ListItem sx={{ px: 0 }}>
              <FormControl fullWidth>
                <FormLabel id="demo-row-radio-buttons-group-label" sx={{ my: 1 }}>
                  범례 방향
                </FormLabel>
                <RadioGroup row aria-labelledby="demo-row-radio-buttons-group-label" name="row-radio-buttons-group">
                  <FormControlLabel value="top" control={<Radio />} label="상" />
                  <FormControlLabel value="bottom" control={<Radio />} label="하" />
                  <FormControlLabel value="left" control={<Radio />} label="좌" />
                  <FormControlLabel value="right" control={<Radio />} label="우" />
                </RadioGroup>
              </FormControl>
            </ListItem>
          </List>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default WidgetAttributeSelect;
