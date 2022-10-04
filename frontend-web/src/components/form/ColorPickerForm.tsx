import React, { useState } from 'react';
import { FormControl, IconButton, Popover } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import { SketchPicker } from 'react-color';

const ColorPickerForm = props => {
  const { name, color, onChange } = props;

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCompleteChange = selectColor => {
    setAnchorEl(null);
    const event = { target: { name: name, value: selectColor.hex } };
    onChange(event);
  };

  const open = Boolean(anchorEl);
  const popoverId = open ? '색상 선택 팝업' : undefined;

  return (
    <FormControl sx={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      <IconButton aria-label="색상 선택" sx={{ border: '1px solid #c4c4c4', bgcolor: '#fff' }} onClick={handleClick}>
        <CircleIcon sx={{ color: color }} />
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
        <SketchPicker color={color} onChangeComplete={handleCompleteChange} />
      </Popover>
    </FormControl>
  );
};

export default ColorPickerForm;
