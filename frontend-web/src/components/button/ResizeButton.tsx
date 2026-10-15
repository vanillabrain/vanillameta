import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ResizeIcon from '@/assets/images/icon/ic-resize.svg?react';

type IconButtonSize = React.ComponentProps<typeof Button>['size'] | 'small' | 'medium' | 'large';

type ResizeButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: IconButtonSize;
};

/** Legacy MUI icon sizes narrow onto the shadcn icon variants. */
const iconButtonSize = (size?: IconButtonSize): React.ComponentProps<typeof Button>['size'] =>
  size === 'small' ? 'icon-xs' : size === 'medium' || size === 'large' ? 'icon-sm' : size || 'icon-sm';

const ResizeButton = React.forwardRef<HTMLButtonElement, ResizeButtonProps>(function ResizeButton(props, ref) {
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
      <ResizeIcon />
    </Button>
  );
});

export default ResizeButton;
