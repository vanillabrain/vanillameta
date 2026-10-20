import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import IconDelete from '@/assets/images/icon/trash-can.svg?react';

type IconButtonSize = React.ComponentProps<typeof Button>['size'] | 'small' | 'medium' | 'large';

type DeleteButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  fill?: string;
  width?: string | number;
  height?: string | number;
  size?: IconButtonSize;
};

/** Legacy MUI icon sizes narrow onto the shadcn icon variants. */
const iconButtonSize = (size?: IconButtonSize): React.ComponentProps<typeof Button>['size'] =>
  size === 'small' ? 'icon-xs' : size === 'medium' || size === 'large' ? 'icon-sm' : size || 'icon-sm';

const DeleteButton = React.forwardRef<HTMLButtonElement, DeleteButtonProps>(function DeleteButton(props, ref) {
  const { fill = '#4A4A4A', width = '24', height = '24', size, className = '', ...rest } = props;
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size={iconButtonSize(size)}
      className={cn('shrink-0 text-muted-foreground hover:text-foreground', className)}
      {...rest}
    >
      <IconDelete style={{ width: width, height: height }} fill={fill} />
    </Button>
  );
});

export default DeleteButton;
