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
    { key: 1 },
    // { key: 2 }, { key: 3 }, { key: 4 }, { key: 5 }, { key: 6 }
  ];

  const [isConnected, setIsConnected] = useState(false);
  const [age, setAge] = React.useState('');

  const handleChange = (event: SelectChangeEvent) => {
    setAge(event.target.value as string);
  };

  const handleSubmit = data => {
    data.preventDefault();
    const userData = {
      userSetName: data.target.userSetName.value,
      userSetContent: data.target.userSetContent.value,
    };
    console.log(userData);
    setIsConnected(true);
  };

  const listItem = (
    <ListItem sx={{ width: '100%', px: 0 }}>
      <FormControl
        fullWidth
        sx={{ flexDirection: 'row', columnGap: 1, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <FormLabel sx={{ width: '20%' }}>X축</FormLabel>
        <Select
          size="small"
          id="demo-simple-select"
          value={age}
          onChange={handleChange}
          sx={{ width: '60%', minWidth: 100 }}
        >
          <MenuItem value={1}>1</MenuItem>
          <MenuItem value={2}>2</MenuItem>
          <MenuItem value={3}>3</MenuItem>
        </Select>
        <IconButton aria-label="색상 선택">
          <PaletteIcon />
        </IconButton>
      </FormControl>
    </ListItem>
  );

  return (
    <Stack component="form" flexDirection="column" spacing={3} onSubmit={handleSubmit}>
      <TitleBox title="위젯 속성 설정" />
      <Grid container component="form" id="widgetAttribute" justifyContent="space-around" rowSpacing={3}>
        <Grid item xs={8}>
          <TextField
            id="userWidgetName"
            label="위젯 이름"
            placeholder="위젯의 이름을 입력해 주세요"
            autoFocus
            required
            fullWidth
          />
          <Box sx={{ width: '100%', height: 500, borderRadius: 1, backgroundColor: '#eee' }} />
        </Grid>
        <Grid item xs={3}>
          <List sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 1 }}>
            {data.map(item => (
              <React.Fragment key={item.key}>
                {listItem}
                {listItem}
                {listItem}
                {listItem}
                <ListItem sx={{ px: 0 }}>
                  <FormControl fullWidth>
                    <FormLabel id="demo-row-radio-buttons-group-label" sx={{ mb: 1 }}>
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
              </React.Fragment>
            ))}
          </List>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default WidgetAttributeSelect;
