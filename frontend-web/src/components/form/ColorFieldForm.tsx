import React, { useId, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, FormLabel, OutlinedInput, Stack } from '@mui/material';
import ColorPickerForm from './ColorPickerForm';

const ColorFieldForm = props => {
  const { t } = useTranslation();
  const { id, label, value = '#eee', colorList, setOption, index = 0, endButton, ...rest } = props;
  const generatedId = useId();
  const [inputColor, setInputColor] = useState(value);
  useEffect(() => setInputColor(value), [value]);
  const controlId = id || generatedId;
  const labelItem = Array.isArray(label) ? label[index] : label;
  const accessibleName = labelItem || `${t('common.colorValue')} ${index + 1}`;
  const handleChange = event => {
    const color = event.target.value;
    setOption(previous =>
      previous.color
        ? {
            ...previous,
            color: previous.color.map((item, position) => (position === index ? color : item)),
          }
        : {
            ...previous,
            series: {
              ...previous.series,
              color: previous.series.color.map((item, position) => (position === index ? color : item)),
            },
          },
    );
  };
  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {labelItem && (
        <FormLabel
          htmlFor={controlId}
          sx={{ width: '35%', pr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {labelItem}
        </FormLabel>
      )}
      <Stack direction="row" sx={{ width: labelItem ? '65%' : '100%', minWidth: 0 }} alignItems="center" spacing={1}>
        <ColorPickerForm label={`${accessibleName} ${t('common.colorPicker')}`} color={inputColor} onChange={handleChange} />
        <OutlinedInput
          {...rest}
          id={controlId}
          value={inputColor}
          type="text"
          margin="dense"
          fullWidth
          sx={{ minWidth: 0 }}
          onChange={event => setInputColor(event.target.value)}
          onBlur={event => {
            if (event.target.value !== value) handleChange(event);
          }}
          inputProps={{ 'aria-label': accessibleName, ...rest.inputProps }}
        />
        {endButton}
      </Stack>
    </FormControl>
  );
};
export default ColorFieldForm;
