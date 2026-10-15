import React, { useId } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

function RadioForm(props) {
  const { id, label, option, name, value, onChange, className, ...rest } = props;
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const labelId = groupId + '-label';

  const handleValueChange = next => {
    if (!onChange) {
      return;
    }
    // Radix only carries string values; hand the original option value back to callers.
    const matched = option.find(item => String(item.value) === next);
    onChange({ target: { name, value: matched ? matched.value : next } });
  };

  return (
    <Field orientation="horizontal" className={cn('items-start gap-2', className)}>
      <FieldLabel id={labelId} className="mt-1 w-[40%] flex-none truncate">
        {label}
      </FieldLabel>
      <FieldContent className="w-[60%] flex-none">
        <RadioGroup
          id={groupId}
          aria-labelledby={labelId}
          value={value === undefined || value === null ? undefined : String(value)}
          onValueChange={handleValueChange}
          className="flex w-full flex-row flex-wrap justify-between gap-2"
          {...rest}
        >
          {option.map(item => {
            const itemId = groupId + '-' + String(item.value);
            return (
              <div key={String(item.value)} className="flex items-center gap-2">
                <RadioGroupItem id={itemId} value={String(item.value)} aria-labelledby={itemId + '-label'} />
                <Label id={itemId + '-label'} htmlFor={itemId} className="cursor-pointer">
                  {item.label}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </FieldContent>
    </Field>
  );
}

RadioForm.defaultProps = {
  label: 'label',
  option: [],
};

export default RadioForm;
