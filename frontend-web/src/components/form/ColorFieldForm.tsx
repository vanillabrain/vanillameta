import React, { useId, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ColorPickerForm from './ColorPickerForm';

const ColorFieldForm = props => {
  const { t } = useTranslation();
  const { id, label, value = '#eee', colorList, setOption, index = 0, endButton, inputProps, className, ...rest } = props;
  const generatedId = useId();
  const [inputColor, setInputColor] = useState(value);
  useEffect(() => setInputColor(value), [value]);
  const controlId = id || generatedId;
  const labelItem = Array.isArray(label) ? label[index] : label;
  const accessibleName = labelItem || t('common.colorValue') + ' ' + (index + 1);
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
    <div className={cn('flex w-full flex-row items-center justify-between gap-2', className)}>
      {labelItem && (
        <Label htmlFor={controlId} className="w-[35%] truncate pr-2">
          {labelItem}
        </Label>
      )}
      <div className={cn('flex min-w-0 flex-row items-center gap-2', labelItem ? 'w-[65%]' : 'w-full')}>
        <ColorPickerForm label={accessibleName + ' ' + t('common.colorPicker')} color={inputColor} onChange={handleChange} />
        <Input
          {...rest}
          {...inputProps}
          id={controlId}
          value={inputColor}
          type="text"
          aria-label={accessibleName}
          className="h-8 min-w-0 bg-background"
          onChange={event => setInputColor(event.target.value)}
          onBlur={event => {
            if (event.target.value !== value) handleChange(event);
          }}
        />
        {endButton}
      </div>
    </div>
  );
};
export default ColorFieldForm;
