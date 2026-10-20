import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import ColorPickerForm from './ColorPickerForm';

function SelectChipForm(props) {
  const { t } = useTranslation();
  const { label, color, option = [], value, onChange, name, disabled, className } = props;
  const [chipColor, setChipColor] = useState('#eee');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (color) {
      setChipColor('#eee');
    }
  }, [color]);

  const selected = Array.isArray(value) ? value : [];

  const handleToggle = itemValue => {
    const next = selected.includes(itemValue) ? selected.filter(entry => entry !== itemValue) : selected.concat([itemValue]);
    if (onChange) {
      onChange({ target: { name, value: next } });
    }
  };

  return (
    <div className={cn('flex w-full flex-row items-center justify-between gap-2', className)}>
      {label && <span className="w-[40%] truncate text-sm font-medium">{label}</span>}
      <div className={cn('flex min-w-0 items-center gap-2', label ? 'w-[60%]' : 'w-full')}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label={label}
              aria-haspopup="listbox"
              disabled={disabled}
              className="h-8 min-w-0 flex-1 justify-start overflow-hidden bg-background px-2 font-normal"
            >
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {selected.map(entry => (
                  <Badge
                    key={String(entry)}
                    variant="secondary"
                    className="max-w-full truncate"
                    style={{ backgroundColor: chipColor }}
                  >
                    {entry}
                  </Badge>
                ))}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[240px] gap-1 p-2">
            {option.map(item => {
              const itemId = (name ? name : 'select-chip') + '-' + String(item.value);
              return (
                <div key={String(item.value)} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={itemId}
                    checked={selected.includes(item.value)}
                    onCheckedChange={() => handleToggle(item.value)}
                    disabled={disabled}
                  />
                  <Label htmlFor={itemId} className="cursor-pointer font-normal">
                    {item.label}
                  </Label>
                </div>
              );
            })}
          </PopoverContent>
        </Popover>
        {color && (
          <ColorPickerForm
            label={t('common.colorPicker')}
            color={chipColor}
            onChange={event => setChipColor(event.target.value)}
          />
        )}
      </div>
    </div>
  );
}

SelectChipForm.defaultProps = {
  label: 'label',
  option: [],
  color: undefined,
};

export default SelectChipForm;
