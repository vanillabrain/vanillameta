import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Stack } from '@mui/material';

export const ConfirmButton = props => {
  const { t } = useTranslation();
  const { confirmLabel, confirmProps, sx } = props;
  return (
    <Button variant="contained" sx={{ minWidth: '55px', minHeight: '32px', ...sx }} {...confirmProps}>
      {confirmLabel}
    </Button>
  );
};

export const CancelButton = props => {
  const { cancelLabel, cancelProps } = props;
  return (
    <Button variant="outlined" sx={{ minWidth: '55px', minHeight: '32px' }} {...cancelProps}>
      {cancelLabel}
    </Button>
  );
};

const ConfirmCancelButton = props => {
  const { t } = useTranslation();
  const {
    secondButton,
    firstButton,
    confirmLabel = t('common.save'),
    cancelLabel = t('common.cancel'),
    confirmProps,
    cancelProps,
  } = props;

  return (
    <Stack direction="row-reverse" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0}>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {secondButton ?? <ConfirmButton confirmLabel={confirmLabel} confirmProps={confirmProps} />}
      </Box>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {firstButton ?? <CancelButton cancelLabel={cancelLabel} cancelProps={cancelProps} />}
      </Box>
    </Stack>
  );
};

export default ConfirmCancelButton;
