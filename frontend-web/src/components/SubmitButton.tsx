import React from 'react';
import { Alert, Box, Button, IconButton, Stack } from '@mui/material';
import { Close } from '@mui/icons-material';

function SubmitButton(props) {
  const [open, setOpen] = React.useState(false);

  const handleClick = event => {
    setOpen(true);
  };

  const handleClose = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };
  return (
    <Box width="100%">
      <Button
        type={props.type || 'button'}
        variant="contained"
        size="large"
        sx={{ mt: 3, mx: 2, ml: 0 }}
        fullWidth
        onClick={handleClick}
      >
        {props.label}
      </Button>
      {open && (
        <Box mt={3}>
          <Alert
            severity="success"
            action={
              <IconButton color="inherit" size="small" onClick={handleClose}>
                <Close />
              </IconButton>
            }
          >
            Success!
          </Alert>
        </Box>
      )}
    </Box>
  );
}

export default SubmitButton;
