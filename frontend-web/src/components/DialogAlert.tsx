import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton } from '@mui/material';
import { Close, Delete } from '@mui/icons-material';

function DialogAlert(props) {
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const button = props.button || (
    <IconButton size={props.size || 'medium'} onClick={handleClickOpen}>
      {props.iconButton || false}
    </IconButton>
  );

  return (
    <React.Fragment>
      {button}
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
          <DialogContentText id="경고 문구">{props.children}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit" autoFocus>
            취소
          </Button>
          <Button onClick={handleClose} color="error">
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default DialogAlert;
