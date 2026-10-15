import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SubmitButton = React.forwardRef<HTMLButtonElement, any>(function SubmitButton(props, ref) {
  const { onClick, className, disabled = false, type = 'button', size = 'default', label, ...rest } = props;
  return (
    <Button
      ref={ref}
      type={type}
      variant="default"
      size={size === 'large' ? 'lg' : size}
      className={cn('h-9 w-full', className)}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {label}
    </Button>
  );
});

export default SubmitButton;
