import React, { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Separator } from '@/components/ui/separator';

interface IProps {
  message: string | JSX.Element;
  close: any;
  options: {
    title?: string | JSX.Element;
    actions?: {
      copy: string;
      onClick: any;
    }[];
    closeCopy?: string;
    type?: 'error' | 'warning' | 'success' | 'info';
  };
}

const TOAST_DURATION = 6000;

export const SnackbarTemplate = props => {
  const { close, message, options } = props;
  const severity = options?.type ?? 'info';

  useEffect(() => {
    const timer = setTimeout(() => close(), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [close]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-60 flex w-full max-w-[460px] -translate-x-1/2 items-start gap-1 px-4">
      <Notice severity={severity} className="pointer-events-auto flex-1 shadow-md">
        {message}
      </Notice>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Close"
        className="pointer-events-auto shrink-0"
        onClick={() => close()}
      >
        <X />
      </Button>
    </div>
  );
};

const buttonClassName = 'h-9 min-w-20 px-2.5 text-[13px] font-bold';

const AlertTemplate = ({ close, message, options }: IProps) => {
  const { t } = useTranslation();
  const hasTitle = options?.title && options.title.toString().trim() !== '';
  const id = useId();
  const actions = options?.actions ?? [];

  return (
    <AlertDialog
      open
      onOpenChange={next => {
        if (!next) close();
      }}
    >
      <AlertDialogContent
        aria-labelledby={id + '-title'}
        aria-describedby={id + '-description'}
        onEscapeKeyDown={() => close()}
        className="max-w-[calc(100vw-32px)] gap-0 rounded-[4px] p-0 sm:max-w-[500px]"
      >
        <AlertDialogHeader className="place-items-start gap-0 p-5 pb-4 text-left">
          <AlertDialogTitle id={id + '-title'} className="text-sm leading-normal font-bold">
            {hasTitle ? options.title : t('common.confirm')}
          </AlertDialogTitle>
        </AlertDialogHeader>
        {hasTitle ? <Separator className="bg-foreground/10" /> : null}
        <AlertDialogDescription
          id={id + '-description'}
          className="max-w-[500px] px-5 pt-5 text-center text-sm leading-6 whitespace-pre-wrap text-foreground"
        >
          {message}
        </AlertDialogDescription>
        <AlertDialogFooter className="mx-6 my-6 flex-row justify-center gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-center">
          {actions.map((action, index) => (
            <AlertDialogAction
              key={index}
              className={buttonClassName}
              onClick={() => {
                action.onClick();
              }}
            >
              {action.copy}
            </AlertDialogAction>
          ))}
          <AlertDialogCancel className={buttonClassName}>{options?.closeCopy || t('common.confirm')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AlertTemplate;
