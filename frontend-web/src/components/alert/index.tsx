import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import { Alert, Divider, Portal, Snackbar } from '@mui/material';

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
  };
}

export const SnackbarTemplate = props => {
  const { close, message, options } = props;
  // console.log(props);
  return (
    <Portal>
      <Snackbar open autoHideDuration={6000} onClose={close} sx={{ zIndex: 9999 }}>
        <Alert onClose={close} severity={options.type} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Portal>
  );
};

const buttonStyle = { minWidth: 80, height: 36, padding: '0 10px', fontSize: '13px', fontWeight: 'bold' };

const AlertTemplate = ({ close, message, options }: IProps) => {
  const { t } = useTranslation();
  const hasTitle = options.title && options.title.toString().trim() !== '';
  const id = useId();
  const returnFocus = useRef(typeof document === 'undefined' ? null : document.activeElement);
  useEffect(
    () => () => {
      const trigger = returnFocus.current;
      queueMicrotask(() => {
        if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      });
    },
    [],
  );
  return (
    <Dialog
      open={true}
      onClose={close}
      keepMounted
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      PaperProps={{
        sx: {
          borderRadius: '4px',
          minWidth: { xs: 'calc(100vw - 32px)', sm: 0 },
        },
      }}
      BackdropProps={{ style: { background: 'rgba(31, 33, 35, 0.85)' } }}
    >
      <DialogTitle
        id={`${id}-title`}
        sx={{ padding: '16px 20px', fontSize: '14px', fontWeight: 'bold', lineHeight: 'normal' }}
      >
        {hasTitle ? options.title : t('common.confirm')}
      </DialogTitle>
      {hasTitle ? <Divider sx={{ backgroundColor: '#1f2123', opacity: 0.1 }} /> : null}

      <DialogContent>
        <DialogContentText
          id={`${id}-description`}
          sx={{
            fontSize: '14px',
            color: 'black',
            paddingTop: hasTitle ? 0 : '20px',
            width: '100%',
            minWidth: { xs: 0, sm: 300 },
            maxWidth: 500,
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
            lineHeight: '24px',
          }}
        >
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ margin: '24px', padding: 0, justifyContent: 'center' }}>
        {options.actions &&
          options.actions.map((action, index) => (
            <Button
              onClick={() => {
                action.onClick();
                close();
              }}
              variant="contained"
              color="primary"
              sx={buttonStyle}
              key={index}
            >
              {action.copy}
            </Button>
          ))}
        <Button variant="contained" color="primary" sx={buttonStyle} onClick={close} autoFocus={true}>
          {options.closeCopy || t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlertTemplate;
