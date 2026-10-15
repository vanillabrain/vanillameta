import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import FirstStep from './FirstStep';
import SecondStep from './SecondStep';

function Recommend(props) {
  const { t } = useTranslation();
  const { data, ...rest } = props;

  const [open, setOpen] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [isFirstStep, setIsFirstStep] = useState(true);

  const handleOpenClick = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setIsFirstStep(true);
  };

  const handleNextClick = () => {
    if (isFirstStep) {
      setIsFirstStep(false);
    }
  };

  const handlePrevClick = () => {
    if (!isFirstStep) {
      setIsFirstStep(true);
    }
  };

  const handleCompleteClick = () => {
    setOpenDialog(true);
  };

  const handleCompleteClose = () => {
    setOpenDialog(false);
  };

  const handleSubmit = () => {
    setIsFirstStep(true);
    setOpenDialog(false);
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button variant="ghost" size="icon-sm" aria-label={t('dataRecommend.create')} onClick={handleOpenClick}>
        <Sparkles />
      </Button>

      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next) handleClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="flex h-[92%] w-[95%] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <div className="flex shrink-0 items-center gap-4 bg-primary px-4 py-2 text-primary-foreground">
            <Button
              variant="ghost"
              onClick={handleClose}
              aria-label={t('common.close', { defaultValue: '닫기' })}
              className="text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
            >
              <X />
            </Button>
            <DialogTitle className="flex-1 text-lg font-medium">{t('dataRecommend.create')}</DialogTitle>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">{isFirstStep ? <FirstStep data={data} /> : <SecondStep />}</div>

          <div className="flex shrink-0 justify-end px-8 pb-6">
            <ConfirmCancelButton
              confirmLabel={isFirstStep ? t('dataRecommend.next') : t('dataRecommend.create')}
              cancelLabel={isFirstStep ? t('dataRecommend.cancel') : t('dataRecommend.prev')}
              confirmProps={isFirstStep ? { onClick: handleNextClick } : { onClick: handleCompleteClick }}
              cancelProps={isFirstStep ? { onClick: handleClose } : { onClick: handlePrevClick }}
            />
          </div>
        </DialogContent>

        <Dialog
          open={openDialog}
          onOpenChange={next => {
            if (!next) handleClose();
          }}
        >
          <DialogContent showCloseButton={false} className="sm:max-w-[480px]">
            <DialogTitle>{t('dataRecommend.create')}</DialogTitle>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t('dataRecommend.guide')}</p>
              <TextField id="dashboardName" label={t('dataRecommend.nameLabel')} type="text" className="min-w-0" />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={handleCompleteClose}>
                {t('dataRecommend.cancel')}
              </Button>
              <Button onClick={handleSubmit}>{t('dataRecommend.create')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Dialog>
    </React.Fragment>
  );
}

export default Recommend;
