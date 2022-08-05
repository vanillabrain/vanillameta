import React from 'react';
import { Button, Stack } from '@mui/material';

function ConfirmButton(props) {
  return (
    <Stack direction="row" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0} m={1}>
      <Button
        onClick={props.secondary ? props.secondary.onClick || '' : ''}
        variant="outlined"
        disabled={props.secondary ? props.secondary.disabled || false : false}
        sx={{ minWidth: { xs: 60, sm: 100 } }}
      >
        {props.secondary ? props.secondary.label || '취소' : '취소'}
      </Button>
      <Button
        onClick={props.primary ? props.primary.onClick || '' : ''}
        variant="contained"
        disabled={!!props.disabled || (props.primary ? props.primary.disabled || false : false)}
        sx={{ minWidth: { xs: 60, sm: 100 } }}
      >
        {props.primary ? props.primary.label || '저장' : '저장'}
      </Button>
    </Stack>
  );
}

export default ConfirmButton;
