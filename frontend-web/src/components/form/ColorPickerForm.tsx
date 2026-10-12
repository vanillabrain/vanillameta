import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, IconButton, Popover } from '@mui/material';
import { SketchPicker } from 'react-color';
import PaintButton from '@/components/button/PaintButton';

const ColorPickerForm = props => {
  const { t } = useTranslation();
  const { name, color, onChange } = props;
  const popoverId = useId();

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

  return (
    <FormControl sx={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      <IconButton
        aria-label={t('common.colorPicker')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={handleClick}
      >
        <PaintButton color={color} />
      </IconButton>
      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        PaperProps={{ role: 'dialog', 'aria-label': t('common.colorPicker'), 'aria-modal': true }}
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
