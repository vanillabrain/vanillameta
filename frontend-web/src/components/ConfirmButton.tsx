import React from 'react';
import { Button, Stack } from '@mui/material';

function ConfirmButton(props) {
  return (
    <Stack direction="row" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0} m={1}>
      <Button variant="outlined" sx={{ minWidth: { xs: 60, sm: 100 } }}>
        취소
      </Button>
      <Button variant="contained" disabled={!!props.disabled} sx={{ minWidth: { xs: 60, sm: 100 } }}>
        저장
      </Button>
    </Stack>
  );
}

export default ConfirmButton;
