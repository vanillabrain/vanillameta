import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import CloseButton from '@/components/button/CloseButton';

interface ModalPopupProps {
  open: boolean;
  handleClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
}

const ModalPopup = (props: ModalPopupProps) => {
  const { t } = useTranslation();
  const titleId = React.useId();
  const { open, handleClose, title, children } = props;

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        className="flex h-[70%] max-h-[754px] w-[90%] max-w-[1392px] flex-col gap-0 p-2.5 pt-0 sm:w-[80%] sm:max-w-[1392px]"
      >
        <div className="mx-[10px] my-5 flex flex-row items-center justify-between">
          <DialogTitle id={titleId} className="text-xl font-semibold">
            {title}
          </DialogTitle>
          <DialogClose asChild>
            <CloseButton aria-label={t('data.closePreview')} onClick={handleClose} className="p-2.5" />
          </DialogClose>
        </div>
        <div className="flex h-full w-full flex-1 items-center justify-center overflow-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalPopup;
