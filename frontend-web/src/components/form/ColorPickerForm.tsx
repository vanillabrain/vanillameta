import React, { useState } from 'react';
import { FormControl, Popover } from '@mui/material';
import { Button } from '@/components/ui/button';
import { SketchPicker } from 'react-color';
import PaintButton from '@/components/button/PaintButton';

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
      <Button variant="ghost" aria-label="색상 선택" className="min-w-0 p-2" onClick={handleClick}>
        <PaintButton color={color} />
      </Button>
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
        <SketchPicker color={color} onChangeComplete={handleCompleteChange} disableAlpha />
      </Popover>
    </FormControl>
  );
};

export default ColorPickerForm;
