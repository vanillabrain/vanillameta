import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from 'react-alert';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { AuthContext } from '@/contexts/AuthContext';
import authService from '@/api/authService';
import { checkEmail, checkPwd } from '@/utils/util';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { removeToken } from '@/helpers/authHelper';
import { cn } from '@/lib/utils';

const ProfileModify = props => {
  const { className, ...rest } = props;
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
        type="button"
        variant="ghost"
        onClick={handleClickOpen}
        className={cn(
          'h-auto min-h-0 p-0 font-normal text-inherit underline hover:bg-transparent hover:underline',
          className,
        )}
        {...rest}
      >
        {t('profile.title')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next) handleClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          aria-labelledby="customized-dialog-title"
          className="w-[560px] max-w-[calc(100vw-32px)] gap-0 p-0 sm:max-w-[560px]"
        >
          <DialogTitle id="customized-dialog-title" className="relative m-0 p-5 text-xl font-semibold">
            {t('profile.modify')}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="close"
                className="absolute top-[10px] right-[10px] text-[#4a4a4a]"
              >
                <X />
              </Button>
            </DialogClose>
          </DialogTitle>
          <div className="mx-auto mt-[10px] mb-[30px] p-0">
            <form
              id="modifyProfile"
              className="flex w-[360px] max-w-full flex-col gap-5 p-0 pt-[5px]"
              onSubmit={handleSubmit}
            >
              <TextField label="User Id" name="userId" disabled value={userState.userId} />
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
              <TextField
                label="E-mail"
                name="userEmail"
                required
                value={changedUserInfo.userEmail}
                onChange={handleChange}
              />
            </form>
          </div>
          <div className="flex h-16 flex-row items-center justify-end gap-2 border-t border-border px-5">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="text-sm font-semibold text-muted-foreground"
            >
              {t('profile.cancel')}
            </Button>
            <Button type="submit" form="modifyProfile" autoFocus className="text-sm font-semibold">
              {t('profile.submit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileModify;
