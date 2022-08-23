import React, { useState } from 'react';
import {
  IconButton,
  Dialog,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Slide,
  DialogTitle,
  DialogActions,
  TextField,
  DialogContent,
  DialogContentText,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ConfirmCancelButton from '../../../components/button/ConfirmCancelButton';
import FirstStep from './FirstStep';
import SecondStep from './SecondStep';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function Recommend(props) {
  const [open, setOpen] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [isFirstStep, setFirstStep] = useState(true);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleStepToggleClick = () => {
    if (isFirstStep) {
      setFirstStep(false);
    } else {
      setFirstStep(true);
    }
  };

  const handleClickComplete = () => {
    setOpenDialog(true);
  };

  const handleCloseComplete = () => {
    setOpenDialog(false);
  };

  const handleSubmit = () => {
    setFirstStep(true);
    setOpenDialog(false);
    setOpen(false);
  };

  return (
    <React.Fragment>
      <IconButton onClick={handleClickOpen} size="small">
        <AutoAwesomeIcon />
      </IconButton>
      <Dialog open={open} onClose={handleClose} TransitionComponent={Transition} fullWidth maxWidth="xl">
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              대시보드 생성
            </Typography>
          </Toolbar>
        </AppBar>

        {isFirstStep ? <FirstStep /> : <SecondStep />}

        <DialogActions sx={{ px: 4, pb: 3 }}>
          <ConfirmCancelButton
            confirmLabel={isFirstStep ? '다음' : '대시보드 생성'}
            cancelLabel={isFirstStep ? '취소' : '이전'}
            confirmProps={
              isFirstStep ? { disabled: false, onClick: handleStepToggleClick } : { onClick: handleClickComplete }
            }
            cancelProps={isFirstStep ? {} : { onClick: handleStepToggleClick }}
          />

          <Dialog open={openDialog} onClose={handleClose}>
            <DialogTitle>대시보드 생성</DialogTitle>
            <DialogContent>
              <DialogContentText>생성할 대시보드의 이름을 작성해주세요.</DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                id="dashboardName"
                label="대시보드 이름"
                type="text"
                fullWidth
                variant="standard"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseComplete}>취소</Button>
              <Button onClick={handleSubmit}>대시보드 생성</Button>
            </DialogActions>
          </Dialog>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Recommend;
