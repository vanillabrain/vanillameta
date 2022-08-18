import React, { useEffect, useState } from 'react';
import { FormControl, FormLabel, IconButton, OutlinedInput, Popover, Stack, Typography } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import { SketchPicker, SwatchesPicker } from 'react-color';

function ColorFieldForm(props) {
  const { id, label, value, onUpdate, ...rest } = props;

  const [color, setColor] = useState('#000000');
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChangeComplete = color => {
    setColor(color.hex);
    setAnchorEl(null);
    onUpdate({ [id]: color.hex });
  };

  const open = Boolean(anchorEl);
  const popoverId = open ? '색상 선택 팝업' : undefined;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor={id} sx={{ width: '40%' }}>
        {label}
      </FormLabel>
      <Stack flexDirection="row" sx={{ width: '60%' }} justifyContent="space-between" alignItems="center">
        <IconButton
          aria-label="색상 선택"
          sx={{ mr: 1, border: '1px solid #c4c4c4', bgcolor: '#fff' }}
          onClick={handleClick}
        >
          <CircleIcon sx={{ color: value }} />
        </IconButton>
        <Popover
          id={popoverId}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <SketchPicker color={color} onChangeComplete={handleChangeComplete} />
        </Popover>
        <OutlinedInput id={id} value={value} type="text" margin="dense" fullWidth {...rest} />

        {/*<OutlinedInput*/}
        {/*  id={id}*/}
        {/*  value={value}*/}
        {/*  type="color"*/}
        {/*  margin="dense"*/}
        {/*  fullWidth*/}
        {/*  sx={{*/}
        {/*    width: '37.7px',*/}
        {/*    height: '37.7px',*/}
        {/*    flexShrink: 0,*/}
        {/*    p: 0.5,*/}
        {/*    '& .MuiOutlinedInput-input': { height: '100%', p: 0 },*/}
        {/*  }}*/}
        {/*  {...rest}*/}
        {/*/>*/}
        {/*<Typography> {value}</Typography>*/}
      </Stack>
    </FormControl>
  );
}

ColorFieldForm.defaultProps = {
  value: '#000000',
};

export default ColorFieldForm;
