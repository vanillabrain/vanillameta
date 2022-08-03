import React from 'react';
import { Box, Button, Stack, TextField, Snackbar, Alert } from '@mui/material';
// import MuiAlert from '@mui/material/Alert';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';

// const Alert = React.forwardRef(function Alert(props, ref) {
//   return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
// });

function DataSet(props) {
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    setOpen(true);
  };

  const handleClose = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  return (
    <PageContainer>
      <PageTitleBox title="데이터셋 생성">
        <Stack component="form" flexDirection="column" spacing={3} sx={{ maxWidth: 800, m: 'auto' }}>
          <TextField
            id="userSetName"
            label="데이터셋 이름"
            placeholder="데이터셋의 이름을 입력해 주세요"
            autoFocus
            required
            // helperText="데이터셋의 이름을 입력해 주세요"
          />
          <TextField
            id="userSetContent"
            label="데이터셋 입력"
            placeholder="데이터셋의 내용을 입력해 주세요"
            multiline
            minRows={10}
            required
            // helperText="데이터셋의 내용을 입력해 주세요"
          />
          <Box>
            <Button variant="contained" size="large" sx={{ mt: 3, mx: 2, ml: 0 }} fullWidth onClick={handleClick}>
              Test Query
            </Button>
            <Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
              <Alert onClose={handleClose} elevation={2} severity="success" sx={{ width: '100%' }}>
                Success!
              </Alert>
            </Snackbar>
          </Box>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSet;
