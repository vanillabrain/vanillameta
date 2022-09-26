import React, { useState } from 'react';
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
  const { button, children, confirmLabel, cancelLabel, handleDialogSelect, ref } = props;
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

      <Dialog open={open} onClose={handleClose} aria-labelledby="경고" aria-describedby="경고 문구">
        <DialogTitle id="경고" sx={{ mb: 2 }}>
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
          <DialogContentText id="경고 문구">{children}</DialogContentText>
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
  confirmLabel: '삭제',
  cancelLabel: '취소',
};

export default DialogAlertButton;
