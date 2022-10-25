import React, { useState } from 'react';
import { FormControl, IconButton, Popover } from '@mui/material';
import { SketchPicker } from 'react-color';
import PaintButton from '@/components/button/PaintButton';

function ColorButtonForm(props) {
  const { option, setOption, index } = props;

  const color = option.series[index].color || '#eee';
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCompleteChange = selectColor => {
    setAnchorEl(null);
    setOption(prevState => {
      const _tempOption = { ...prevState };
      _tempOption.series.forEach((series, idx) => {
        if (index === idx) {
          series.color = selectColor.hex;
        }
      });

      return _tempOption;
    });
  };

  const open = Boolean(anchorEl);
  const popoverId = open ? '색상 선택 팝업' : undefined;

  return (
    <FormControl sx={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      <IconButton aria-label="색상 선택" onClick={handleClick}>
        <PaintButton color={color} />
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
        <SketchPicker color={color} onChangeComplete={handleCompleteChange} disableAlpha />
      </Popover>
    </FormControl>
  );
}

export default ColorButtonForm;
