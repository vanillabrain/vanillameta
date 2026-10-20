import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ConfirmButton = props => {
  const { confirmLabel, confirmProps = {}, className } = props;
  const { className: confirmClassName, variant = 'default', ...rest } = confirmProps;
  return (
    <Button type="button" variant={variant} className={cn('min-w-[55px]', confirmClassName, className)} {...rest}>
      {confirmLabel}
    </Button>
  );
};

export const CancelButton = props => {
  const { cancelLabel, cancelProps = {}, className } = props;
  const { className: cancelClassName, variant = 'outline', ...rest } = cancelProps;
  return (
    <Button type="button" variant={variant} className={cn('min-w-[55px]', cancelClassName, className)} {...rest}>
      {cancelLabel}
    </Button>
  );
};

const ConfirmCancelButton = props => {
  const { t } = useTranslation();
  const {
    secondButton,
    firstButton,
    confirmLabel = t('common.save'),
    cancelLabel = t('common.cancel'),
    confirmProps,
    cancelProps,
    className,
  } = props;

  return (
    <ul className={cn('flex flex-row-reverse flex-wrap gap-2 p-0', className)}>
      <li className="list-none">
        {secondButton ?? <ConfirmButton confirmLabel={confirmLabel} confirmProps={confirmProps} />}
      </li>
      <li className="list-none">{firstButton ?? <CancelButton cancelLabel={cancelLabel} cancelProps={cancelProps} />}</li>
    </ul>
  );
};

export default ConfirmCancelButton;
