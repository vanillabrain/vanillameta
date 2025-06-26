import * as React from 'react';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const textFieldVariants = cva('relative', {
  variants: {
    variant: {
      outlined: '',
      filled: '',
      standard: '',
    },
    size: {
      small: '',
      medium: '',
    },
    fullWidth: {
      true: 'w-full',
      false: 'inline-block',
    },
  },
  defaultVariants: {
    variant: 'outlined',
    size: 'medium',
    fullWidth: true,
  },
});

// Input variant 스타일
const inputVariantStyles = {
  outlined: '',
  filled: 'bg-muted border-0 border-b rounded-t-md rounded-b-none focus:bg-background',
  standard: 'border-0 border-b rounded-none px-0 focus:ring-0',
};

// Label variant 스타일
const labelVariantStyles = {
  outlined: '',
  filled: '',
  standard: '',
};

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    VariantProps<typeof textFieldVariants> {
  label?: React.ReactNode;
  error?: boolean;
  helperText?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
  rowsMax?: number;
  select?: boolean;
  InputProps?: {
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    inputComponent?: React.ElementType;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  };
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  FormHelperTextProps?: any;
  InputLabelProps?: any;
  SelectProps?: any;
  type?: React.HTMLInputTypeAttribute;
}

const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      label,
      error = false,
      helperText,
      multiline = false,
      rows = 1,
      rowsMax,
      select = false,
      InputProps,
      inputProps,
      FormHelperTextProps,
      InputLabelProps,
      SelectProps,
      required,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || React.useId();

    // multiline인 경우 textarea로 처리
    if (multiline) {
      return (
        <div className={cn(textFieldVariants({ variant, size, fullWidth }), className)}>
          {label && (
            <Label
              htmlFor={inputId}
              className={cn('mb-2 text-sm font-medium', error && 'text-destructive', disabled && 'opacity-50')}
            >
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          <div className="relative">
            {InputProps?.startAdornment && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {InputProps.startAdornment}
              </div>
            )}
            <Textarea
              id={inputId}
              ref={ref as any}
              rows={rows}
              disabled={disabled}
              required={required}
              className={cn(
                inputVariantStyles[variant || 'outlined'],
                error && 'border-destructive focus-visible:ring-destructive',
                InputProps?.startAdornment && 'pl-10',
                InputProps?.endAdornment && 'pr-10',
                size === 'small' && 'text-sm py-1',
              )}
              {...(props as any)}
              {...(inputProps as any)}
            />
            {InputProps?.endAdornment && (
              <div className="absolute right-3 top-3 text-muted-foreground">{InputProps.endAdornment}</div>
            )}
          </div>
          {helperText && (
            <p className={cn('mt-1 text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>{helperText}</p>
          )}
        </div>
      );
    }

    // select인 경우 별도 처리 (향후 Select 컴포넌트로 대체)
    if (select) {
      console.warn('TextField with select prop is not fully implemented yet. Use Select component instead.');
    }

    return (
      <div className={cn(textFieldVariants({ variant, size, fullWidth }), className)}>
        {label && (
          <Label
            htmlFor={inputId}
            className={cn('mb-2 text-sm font-medium', error && 'text-destructive', disabled && 'opacity-50')}
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          {InputProps?.startAdornment && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{InputProps.startAdornment}</div>
          )}
          <Input
            id={inputId}
            ref={ref}
            disabled={disabled}
            required={required}
            className={cn(
              inputVariantStyles[variant || 'outlined'],
              error && 'border-destructive focus-visible:ring-destructive',
              InputProps?.startAdornment && 'pl-10',
              InputProps?.endAdornment && 'pr-10',
              size === 'small' && 'h-8 text-sm',
            )}
            {...props}
            {...InputProps?.inputProps}
            {...inputProps}
          />
          {InputProps?.endAdornment && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{InputProps.endAdornment}</div>
          )}
        </div>
        {helperText && (
          <p className={cn('mt-1 text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>{helperText}</p>
        )}
      </div>
    );
  },
);

TextField.displayName = 'TextField';

export { TextField };
