import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, IconButton, OutlinedInput, Popover, Stack } from '@mui/material';
import { SketchPicker } from 'react-color';
import PaintButton from '@/components/button/PaintButton';

const ColorFieldReForm = props => {
  const { t } = useTranslation();
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
  const popoverId = open ? t('common.colorPickerPopup') : undefined;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Stack flexDirection="row" sx={{ width: '100%' }} justifyContent="space-between" alignItems="center">
        <IconButton aria-label={t('common.colorPicker')} sx={{ mr: 1 }} onClick={handleClick}>
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
        <OutlinedInput value={color} type="text" margin="dense" fullWidth onChange={onChange} />
      </Stack>
    </FormControl>
  );
};

export default ColorFieldReForm;
