import React from 'react';
import { Box, Button, Stack } from '@mui/material';

function ConfirmButton(props) {
  const { confirmLabel, cancelLabel, confirm, cancel } = props;

  return (
    <Stack direction="row-reverse" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0}>
      <Box component="li" sx={{ listStyle: 'none' }}>
        <Button variant="contained" sx={{ minWidth: { xs: 60, sm: 100 } }} {...confirm}>
          {confirmLabel}
        </Button>
      </Box>
      <Box component="li" sx={{ listStyle: 'none' }}>
        <Button variant="outlined" sx={{ minWidth: { xs: 60, sm: 100 } }} {...cancel}>
          {cancelLabel}
        </Button>
      </Box>
    </Stack>
  );
}

ConfirmButton.defaultProps = {
  confirmLabel: '저장',
  cancelLabel: '취소',
};

export default ConfirmButton;
