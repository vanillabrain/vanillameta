import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

function CheckForm(props) {
  const { id, label, className, ...rest } = props;

  return (
    <Field orientation="horizontal" className={cn('items-center gap-2', className)}>
      <FieldLabel htmlFor={id} className="w-[40%] flex-none truncate">
        {label}
      </FieldLabel>
      <FieldContent className="flex w-[60%] flex-none flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox id={id} {...rest} />
          <span className="text-sm">{label}</span>
        </div>
      </FieldContent>
    </Field>
  );
}

export default CheckForm;
