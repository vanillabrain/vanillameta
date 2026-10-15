import React, { forwardRef, useId } from 'react';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  multiline?: boolean;
  minRows?: number;
  rows?: number;
  select?: boolean;
  inputProps?: Record<string, any>;
  inputRef?: React.Ref<FieldControl>;
  InputProps?: { startAdornment?: React.ReactNode; endAdornment?: React.ReactNode; [key: string]: any };
  slotProps?: Record<string, any>;
};

/** Shared labelled field; keeps native change events and IDs used by saved configuration forms. */
export const TextField = forwardRef<FieldControl, TextFieldProps>(function TextField(
  {
    label,
    helperText,
    error,
    multiline,
    minRows,
    rows,
    select,
    inputProps,
    inputRef,
    InputProps,
    slotProps,
    id,
    className,
    children,
    disabled,
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = helperText ? `${controlId}-description` : undefined;
  const native = {
    ...props,
    ...slotProps?.htmlInput,
    ...inputProps,
    id: controlId,
    disabled,
    required,
    'aria-invalid': error || props['aria-invalid'] || undefined,
    'aria-describedby': [props['aria-describedby'], descriptionId].filter(Boolean).join(' ') || undefined,
  };
  return (
    <Field data-invalid={error || undefined} data-disabled={disabled || undefined} className={cn('min-w-0', className)}>
      {label && (
        <FieldLabel htmlFor={controlId}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </FieldLabel>
      )}
      <div className="relative flex min-w-0 items-center gap-2">
        {InputProps?.startAdornment}
        {select ? (
          <NativeSelect {...(native as any)} ref={(inputRef ?? ref) as React.Ref<HTMLSelectElement>} className="w-full">
            {children}
          </NativeSelect>
        ) : multiline ? (
          <Textarea
            {...(native as any)}
            ref={(inputRef ?? ref) as React.Ref<HTMLTextAreaElement>}
            rows={rows ?? minRows ?? 3}
          />
        ) : (
          <Input {...native} ref={(inputRef ?? ref) as React.Ref<HTMLInputElement>} />
        )}
        {InputProps?.endAdornment}
      </div>
      {helperText && <FieldDescription id={descriptionId}>{helperText}</FieldDescription>}
    </Field>
  );
});
