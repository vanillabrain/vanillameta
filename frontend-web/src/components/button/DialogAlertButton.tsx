import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const DialogAlertIconButton = props => {
  const { icon, size = 'medium', children = '', handleDialogSelect } = props;
  const iconButton = (
    <Button
      type="button"
      variant="ghost"
      size={size === 'small' ? 'icon-xs' : 'icon-sm'}
      className="text-muted-foreground hover:text-foreground"
    >
      {icon}
    </Button>
  );

  return <DialogAlertButton button={iconButton} children={children} handleDialogSelect={handleDialogSelect} />;
};

const DialogAlertButton = props => {
  const { t } = useTranslation();
  const {
    button,
    children = '',
    confirmLabel = t('common.delete'),
    cancelLabel = t('common.cancel'),
    handleDialogSelect,
  } = props;
  const [open, setOpen] = useState(false);

  const handleConfirmCancelClick = detail => {
    setOpen(false);
    if (handleDialogSelect) {
      handleDialogSelect(detail);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{button}</DialogTrigger>
      <DialogContent
        aria-labelledby={t('common.warning')}
        aria-describedby={t('common.warningText')}
        className="max-w-[calc(100%-2rem)] sm:max-w-[420px]"
      >
        <DialogTitle id={t('common.warning')} className="sr-only">
          {t('common.warning')}
        </DialogTitle>
        <DialogDescription
          id={t('common.warningText')}
          className="whitespace-pre-wrap pt-2 text-center text-sm text-foreground"
        >
          {children}
        </DialogDescription>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleConfirmCancelClick(1)}>
            {confirmLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={() => handleConfirmCancelClick(0)}>
            {cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DialogAlertButton;
