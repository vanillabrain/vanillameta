import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { checkEmail, checkPwd } from '@/utils/util';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { useNavigate } from 'react-router-dom';
import { removeToken } from '@/helpers/authHelper';

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
  const { t } = useTranslation();
  const { userState, getUserState } = useContext(AuthContext);
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const initialState = {
    userOldPwd: '',
    userNewPwd: '',
    userNewConfirmPwd: '',
    userEmail: userState.userEmail,
  };
  const [changedUserInfo, setChangedUserInfo] = useState(initialState);
  const [open, setOpen] = React.useState(false);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  let isValid;

  const validateData = () => {
    const { userOldPwd, userNewPwd, userNewConfirmPwd, userEmail } = changedUserInfo;
    if (!userOldPwd || !userNewPwd || !userNewConfirmPwd || !userEmail) {
      snackbar.error(t('login.fillAll'));
      return;
    } else {
      if (!checkPwd.test(userNewPwd)) {
        snackbar.error(t('login.pwdFormat'));
        return;
      }
      if (userNewPwd !== userNewConfirmPwd) {
        snackbar.error(t('signup.pwdMismatch'));
        return;
      }
      if (!checkEmail.test(userEmail)) {
        snackbar.error(t('signup.emailFormat'));
        return;
      }
      isValid = true;
    }
  };

  const updateUserInfo = () => {
    const data = {
      userId: userState.userId,
      password: changedUserInfo.userOldPwd,
      new_password: changedUserInfo.userNewPwd,
      email: changedUserInfo.userEmail,
    };
    // console.log(data);
    showLoading();
    authService
      .updateUser(data)
      .then(response => {
        if (response.status === 200) {
          alert.success(t('profile.success'), {
            onClose: () => {
              getUserState();
              setChangedUserInfo(initialState);
            },
          });
        }
      })
      .catch(error => {
        console.log(error);
        if (error.response.data.data === 'not exist user') {
          snackbar.error(t('profile.badCredential'));
        } else if (error.response.data.data === 'Unauthorized') {
          alert.error(t('profile.expired'), {
            onClose: () => {
              removeToken();
              navigate('/login', { replace: true });
            },
          });
        } else {
          alert.error(t('profile.failed'));
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
        {t('profile.title')}
      </Button>
      <BootstrapDialog onClose={handleClose} aria-labelledby="customized-dialog-title" open={open}>
        <BootstrapDialogTitle id="customized-dialog-title" onClose={handleClose}>
          {t('profile.modify')}
        </BootstrapDialogTitle>
        <DialogContent sx={{ m: 'auto', mt: '10px', mb: '30px', p: 0 }}>
          <Stack
            id="modifyProfile"
            component="form"
            gap="20px"
            sx={{ width: '360px', p: 0, pt: '5px' }}
            onSubmit={handleSubmit}
          >
            <TextField label="User Id" name="userId" disabled={true} value={userState.userId} />
            <TextField
              label={t('profile.currentPwd')}
              name="userOldPwd"
              type="password"
              required
              value={changedUserInfo.userOldPwd}
              onChange={handleChange}
            />
            <TextField
              label={t('profile.newPwd')}
              name="userNewPwd"
              type="password"
              required
              value={changedUserInfo.userNewPwd}
              onChange={handleChange}
            />
            <TextField
              label={t('profile.newPwdConfirm')}
              name="userNewConfirmPwd"
              type="password"
              required
              value={changedUserInfo.userNewConfirmPwd}
              onChange={handleChange}
            />
            <TextField label="E-mail" name="userEmail" required value={changedUserInfo.userEmail} onChange={handleChange} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ height: '64px', borderTop: '1px solid #ececec' }}>
          <Button onClick={handleClose} sx={{ fontSize: '14px', fontWeight: 600, color: '#767676' }}>
            {t('profile.cancel')}
          </Button>
          <Button autoFocus form="modifyProfile" type="submit" sx={{ fontSize: '14px', fontWeight: 600 }}>
            {t('profile.submit')}
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </div>
  );
};

export default ProfileModify;
