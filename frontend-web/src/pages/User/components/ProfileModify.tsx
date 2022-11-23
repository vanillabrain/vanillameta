import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  styled,
  TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
  const { children, onClose, ...other } = props;

  return (
    <DialogTitle
      sx={{
        minWidth: '560px',
        m: 0,
        p: '20px',
        fontSize: '20px',
        fontWeight: 600,
      }}
      {...other}
    >
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: '10px',
            top: '10px',
            color: '#4a4a4a',
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

const ProfileModify = props => {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
      <Button
        // aria-describedby={id}
        onClick={handleClickOpen}
        anchorReference="anchorPosition"
        anchorPosition={{ top: '50%', left: '50%' }}
        disableRipple
        disableFocusRipple
        disableTouchRipple
        sx={{
          minWidth: 0,
          minHeight: 0,
          m: 0,
          p: 0,
          fontSize: 'inherit',
          fontWeight: 'inherit',
          textDecoration: 'underline',
          color: 'inherit',
          '&:hover': {
            textDecoration: 'underline',
            backgroundColor: 'inherit',
          },
        }}
        {...props}
      >
        회원정보수정
      </Button>
      <BootstrapDialog onClose={handleClose} aria-labelledby="customized-dialog-title" open={open}>
        <BootstrapDialogTitle id="customized-dialog-title" onClose={handleClose}>
          프로필 수정
        </BootstrapDialogTitle>
        <DialogContent sx={{ m: 'auto', mt: '15px', mb: '30px', p: 0 }}>
          <Stack gap="20px" sx={{ width: '360px', p: 0 }}>
            <TextField label="User Id" name="userId" disabled={true} />
            <TextField label="현재 비밀번호" name="oldPassword" />
            <TextField label="새 비밀번호" name="newPassword" />
            <TextField label="E-mail" name="email" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ height: '64px', borderTop: '1px solid #ececec' }}>
          <Button onClick={handleClose} sx={{ fontSize: '14px', fontWeight: 600, color: '#767676' }}>
            취소
          </Button>
          <Button autoFocus onClick={handleClose} sx={{ fontSize: '14px', fontWeight: 600 }}>
            수정하기
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </div>
  );
};

export default ProfileModify;
