import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import IconClose from '@/assets/images/icon/ic-xmark.svg?react';

type IconButtonSize = React.ComponentProps<typeof Button>['size'] | 'small' | 'medium' | 'large';

type CloseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: IconButtonSize;
};

/** Legacy MUI icon sizes narrow onto the shadcn icon variants. */
const iconButtonSize = (size?: IconButtonSize): React.ComponentProps<typeof Button>['size'] =>
  size === 'small' ? 'icon-xs' : size === 'medium' || size === 'large' ? 'icon-sm' : size || 'icon-sm';

const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(function CloseButton(props, ref) {
  const { size, className = '', ...rest } = props;
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size={iconButtonSize(size)}
      className={cn('shrink-0 text-muted-foreground hover:text-foreground', className)}
      {...rest}
    >
      <IconClose />
    </Button>
  );
});

export default CloseButton;
