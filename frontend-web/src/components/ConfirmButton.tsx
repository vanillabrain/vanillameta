import React from 'react';
import { Box, Button, Stack } from '@mui/material';

function ConfirmButton(props) {
  const primary = {
    form: props.primary ? props.primary.form || undefined : undefined,
    label: props.primary ? props.primary.label || '저장' : '저장',
    disabled: !!props.disabled || (props.primary ? props.primary.disabled || undefined : undefined),
    handleClick: props.primary ? props.primary.onClick || undefined : undefined,
    handleSubmit: props.primary ? props.primary.onSubmit || undefined : undefined,
  };
  const secondary = {
    label: props.secondary ? props.secondary.label || '취소' : '취소',
    disabled: !!props.disabled || (props.secondary ? props.secondary.disabled || undefined : undefined),
    handleClick: props.secondary ? props.secondary.onClick || undefined : undefined,
  };

  return (
    <Stack direction="row-reverse" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0}>
      <Box component="li" sx={{ listStyle: 'none' }}>
        <Button
          form={primary.form}
          type="submit"
          onClick={primary.handleClick}
          onSubmit={primary.handleSubmit}
          disabled={primary.disabled}
          variant="contained"
          sx={{ minWidth: { xs: 60, sm: 100 } }}
        >
          {primary.label}
        </Button>
      </Box>
      <Box component="li" sx={{ listStyle: 'none' }}>
        <Button
          onClick={secondary.handleClick}
          disabled={secondary.disabled}
          variant="outlined"
          sx={{ minWidth: { xs: 60, sm: 100 } }}
        >
          {secondary.label}
        </Button>
      </Box>
    </Stack>
  );
}

export default ConfirmButton;
