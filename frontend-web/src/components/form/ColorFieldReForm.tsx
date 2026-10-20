import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ColorPickerForm from './ColorPickerForm';

const ColorFieldReForm = props => {
  const { name, color, onChange, index = 0, className } = props;
  const { t } = useTranslation();
  const controlId = useId();
  const [inputColor, setInputColor] = useState(color);
  useEffect(() => setInputColor(color), [color]);
  const label = t('common.colorValue') + ' ' + (index + 1);
  return (
    <div className={cn('flex w-full flex-col', className)}>
      <div className="flex w-full min-w-0 flex-row items-center gap-2">
        <ColorPickerForm label={label + ' ' + t('common.colorPicker')} name={name} color={inputColor} onChange={onChange} />
        <Input
          id={controlId}
          name={name}
          value={inputColor}
          type="text"
          aria-label={label}
          className="h-8 min-w-0 bg-background"
          onChange={event => setInputColor(event.target.value)}
          onBlur={event => {
            if (event.target.value !== color) onChange(event);
          }}
        />
      </div>
    </div>
  );
};
export default ColorFieldReForm;
