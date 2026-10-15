import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import IconAdd from '@/assets/images/icon/ic-add.svg?react';

type IconButtonSize = React.ComponentProps<typeof Button>['size'] | 'small' | 'medium' | 'large';

type AddButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: IconButtonSize;
};

/** The compact add control keeps its 24px footprint unless a caller asks for the larger icon size. */
const addButtonSize = (size?: IconButtonSize): React.ComponentProps<typeof Button>['size'] =>
  size === 'icon-sm' || size === 'icon-lg' ? size : 'icon-xs';

const AddButton = React.forwardRef<HTMLButtonElement, AddButtonProps>(function AddButton(props, ref) {
  const { size, className = '', ...rest } = props;
  return (
    <Button
      ref={ref}
      type="button"
      size={addButtonSize(size)}
      className={cn('min-w-0 rounded-[4px] p-0', className)}
      {...rest}
    >
      <IconAdd />
    </Button>
  );
});

export default AddButton;
