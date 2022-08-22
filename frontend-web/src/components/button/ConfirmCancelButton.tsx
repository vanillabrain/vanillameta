import React, { useState, useEffect } from 'react';
import { Box, Button, Stack } from '@mui/material';

export const ConfirmButton = props => {
  const { confirmLabel, confirmProps } = props;
  return (
    <Button variant="contained" sx={{ minWidth: { xs: 60, sm: 100 } }} {...confirmProps}>
      {confirmLabel}
    </Button>
  );
};

export const CancelButton = props => {
  const { cancelLabel, cancelProps } = props;
  return (
    <Button variant="outlined" sx={{ minWidth: { xs: 60, sm: 100 } }} {...cancelProps}>
      {cancelLabel}
    </Button>
  );
};

const ConfirmCancelButton = props => {
  const { confirmButton, cancelButton, confirmLabel, cancelLabel, confirmProps, cancelProps, ...rest } = props;

  const initialConfirm = <ConfirmButton confirmLabel={confirmLabel} confirmProps={confirmProps} />;
  const initialCancel = <CancelButton cancelLabel={cancelLabel} cancelProps={cancelProps} />;

  const [changeConfirm, setChangeConfirm] = useState(initialConfirm);
  const [changeCancel, setChangeCancel] = useState(initialCancel);

  useEffect(() => {
    if (confirmButton !== undefined) {
      setChangeConfirm(confirmButton);
    } else if (cancelButton !== undefined) {
      setChangeCancel(cancelButton);
    }
  }, [confirmButton, cancelButton]);

  return (
    <Stack direction="row-reverse" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0}>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {changeConfirm}
      </Box>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {changeCancel}
      </Box>
    </Stack>
  );
};

ConfirmCancelButton.defaultProps = {
  confirmLabel: '저장',
  cancelLabel: '취소',
};

export default ConfirmCancelButton;
