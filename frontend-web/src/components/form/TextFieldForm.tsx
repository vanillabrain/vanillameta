import React, { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

function TextFieldForm(props) {
  const {
    id,
    label,
    type = 'text',
    name,
    value,
    endButton,
    required,
    onChange,
    inputProps,
    className,
    multiline,
    rows,
    ...rest
  } = props;
  const generatedId = useId();
  const controlId = id ?? generatedId;

  const [text, setText] = useState(value);
  const handleChange = event => {
    setText(event.target.value);
    onChange(event);
  };

  return (
    <Field orientation="horizontal" className={cn('items-center gap-2', className)}>
      <FieldLabel htmlFor={controlId} className="w-[35%] flex-none truncate">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </FieldLabel>
      <FieldContent className="flex min-w-0 flex-1 flex-row items-center justify-between">
        {multiline ? (
          <Textarea
            id={controlId}
            name={name}
            value={text}
            required={required}
            rows={typeof rows === 'number' ? rows : 3}
            onChange={handleChange}
            className={cn('h-auto bg-background', endButton ? 'w-[calc(100%-38px)] shrink' : 'w-full')}
            {...inputProps}
            {...rest}
          />
        ) : (
          <Input
            id={controlId}
            type={type}
            name={name}
            value={text}
            required={required}
            onChange={handleChange}
            className={cn('h-8 bg-background', endButton ? 'w-[calc(100%-38px)] shrink' : 'w-full')}
            {...inputProps}
            {...rest}
          />
        )}
        {!!endButton ? <div className="ml-1 w-[38px]">{endButton}</div> : null}
      </FieldContent>
    </Field>
  );
}

TextFieldForm.defaultProps = {
  type: 'text',
};

export default TextFieldForm;
