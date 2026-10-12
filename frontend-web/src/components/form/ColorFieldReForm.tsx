import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, OutlinedInput, Stack } from '@mui/material';
import ColorPickerForm from './ColorPickerForm';

const ColorFieldReForm = props => {
  const { name, color, onChange, index = 0 } = props;
  const { t } = useTranslation();
  const controlId = useId();
  const [inputColor, setInputColor] = useState(color);
  useEffect(() => setInputColor(color), [color]);
  const label = `${t('common.colorValue')} ${index + 1}`;
  return (
    <FormControl fullWidth>
      <Stack direction="row" spacing={1} sx={{ width: '100%', minWidth: 0 }} alignItems="center">
        <ColorPickerForm label={`${label} ${t('common.colorPicker')}`} name={name} color={inputColor} onChange={onChange} />
        <OutlinedInput
          id={controlId}
          name={name}
          value={inputColor}
          type="text"
          margin="dense"
          fullWidth
          onChange={event => setInputColor(event.target.value)}
          onBlur={event => {
            if (event.target.value !== color) onChange(event);
          }}
          inputProps={{ 'aria-label': label }}
          sx={{ minWidth: 0 }}
        />
      </Stack>
    </FormControl>
  );
};
export default ColorFieldReForm;
