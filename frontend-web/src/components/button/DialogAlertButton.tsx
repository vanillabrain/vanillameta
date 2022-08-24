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
  const { icon, size, children } = props;
  const iconButton = (
    <IconButton component="div" size={size}>
      {icon}
    </IconButton>
  );

  return <DialogAlertButton button={iconButton} children={children} />;
};

DialogAlertIconButton.defaultProps = {
  icon: undefined,
  size: 'medium',
  children: '',
};

const DialogAlertButton = props => {
  const { button, children, ref } = props;
  const [open, setOpen] = useState(false);

  const handleOpenClick = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
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
          <Button onClick={handleClose} color="inherit">
            취소
          </Button>
          <Button onClick={handleClose} color="error">
            삭제
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
