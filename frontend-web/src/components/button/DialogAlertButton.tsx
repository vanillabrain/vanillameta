import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';

export const DialogAlertIconButton = props => {
  const { t } = useTranslation();
  const { icon, size, children, handleDialogSelect } = props;
  const iconButton = (
    <IconButton component="div" size={size}>
      {icon}
    </IconButton>
  );

  return <DialogAlertButton button={iconButton} children={children} handleDialogSelect={handleDialogSelect} />;
};

DialogAlertIconButton.defaultProps = {
  icon: undefined,
  size: 'medium',
  children: '',
};

const DialogAlertButton = props => {
  const { t } = useTranslation();
  const {
    button,
    children,
    confirmLabel = t('common.delete'),
    cancelLabel = t('common.cancel'),
    handleDialogSelect,
    ref,
  } = props;
  const [open, setOpen] = useState(false);

  const handleOpenClick = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleConfirmCancelClick = detail => {
    setOpen(false);
    if (handleDialogSelect) {
      handleDialogSelect(detail);
    }
  };

  return (
    <React.Fragment>
      <ButtonBase onClick={handleOpenClick}>{button}</ButtonBase>

      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby={t('common.warning')}
        aria-describedby={t('common.warningText')}
      >
        <DialogTitle id={t('common.warning')} sx={{ mb: 2 }}>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: theme => theme.palette.grey[500],
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DialogContentText id={t('common.warningText')}>{children}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConfirmCancelClick(1)} color="inherit">
            {confirmLabel}
          </Button>
          <Button onClick={() => handleConfirmCancelClick(0)} color="error">
            {cancelLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};

DialogAlertButton.defaultProps = {
  button: undefined,
  children: '',
};

export default DialogAlertButton;
