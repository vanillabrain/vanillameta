import React, { useContext, useState } from 'react';
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
import { AuthContext } from '@/contexts/AuthContext';
import authService from '@/api/authService';
import { checkEmail, checkPwd } from '@/utils/validateUtil';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  minWidth: '560px',

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
  const { userState } = useContext(AuthContext);
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const initialState = {
    userOldPwd: '',
    userNewPwd: '',
    userNewConfirmPwd: '',
    userEmail: '',
  };
  const [changedUserInfo, setChangedUserInfo] = useState(initialState);
  const [open, setOpen] = React.useState(false);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  let isValid;

  const validateData = () => {
    const { userOldPwd, userNewPwd, userNewConfirmPwd, userEmail } = changedUserInfo;
    if (!userOldPwd || !userNewPwd || !userNewConfirmPwd || !userEmail) {
      snackbar.error('입력란을 모두 작성해 주세요.');
      return;
    } else {
      if (userNewPwd !== userNewConfirmPwd) {
        snackbar.error('비밀번호가 서로 다릅니다.');
        return;
      }
      if (!checkPwd.test(userNewPwd)) {
        snackbar.error('비밀번호는 8글자 이상이며 숫자와 영문 대소문자, 특수문자가 포함되어 있어야 합니다.');
        return;
      }
      if (!checkEmail.test(userEmail)) {
        snackbar.error('E-mail의 형식이 맞는지 확인해 주세요.');
        return;
      }
      isValid = true;
    }
  };

  const updateUserInfo = () => {
    const data = {
      user_id: userState.userId,
      password: changedUserInfo.userOldPwd,
      new_password: changedUserInfo.userNewPwd,
      email: changedUserInfo.userEmail,
    };
    showLoading();
    authService
      .updateUser(data)
      .then(response => {
        console.log(response);
        if (response.state === 20) {
          alert.success('프로필 수정에 성공했습니다.');
        } else {
          alert.error('프로필 수정에 실패했습니다.');
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
    setChangedUserInfo(initialState);
  };

  const handleChange = event => {
    event.preventDefault();
    setChangedUserInfo(prevState => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    validateData();
    if (isValid) {
      updateUserInfo();
      setOpen(false);
      setChangedUserInfo(initialState);
    }
  };

  return (
    <div>
      <Button
        onClick={handleClickOpen}
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
        <DialogContent sx={{ m: 'auto', mt: '10px', mb: '30px', p: 0 }}>
          {/*<FormControl required sx={{ m: 'auto', mt: '10px', mb: '30px', p: 0 }}>*/}
          <Stack
            id="modifyProfile"
            component="form"
            gap="20px"
            sx={{ width: '360px', p: 0, pt: '5px' }}
            onSubmit={handleSubmit}
          >
            <TextField label="User Id" name="userId" disabled={true} value={userState.userId} />
            <TextField
              label="현재 비밀번호"
              name="userOldPwd"
              type="password"
              required
              value={changedUserInfo.userOldPwd}
              onChange={handleChange}
            />
            <TextField
              label="새 비밀번호"
              name="userNewPwd"
              type="password"
              required
              value={changedUserInfo.userNewPwd}
              onChange={handleChange}
            />
            <TextField
              label="새 비밀번호 확인"
              name="userNewConfirmPwd"
              type="password"
              required
              value={changedUserInfo.userNewConfirmPwd}
              onChange={handleChange}
            />
            <TextField label="E-mail" name="userEmail" required value={changedUserInfo.userEmail} onChange={handleChange} />
            {/*</FormControl>*/}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ height: '64px', borderTop: '1px solid #ececec' }}>
          <Button onClick={handleClose} sx={{ fontSize: '14px', fontWeight: 600, color: '#767676' }}>
            취소
          </Button>
          <Button autoFocus form="modifyProfile" type="submit" sx={{ fontSize: '14px', fontWeight: 600 }}>
            수정하기
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </div>
  );
};

export default ProfileModify;
