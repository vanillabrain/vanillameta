import { Box, IconButton, Modal, Paper, Stack, Typography } from '@mui/material';
import { ReactComponent as CloseIcon } from '@/assets/images/icon/ic-xmark.svg';
import React from 'react';

interface ModalPopupProps {
  open: boolean;
  handleClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
}

const ModalPopup = (props: ModalPopupProps) => {
  const { open, handleClose, title, children } = props;
  return (
    <Modal
      open={open}
      onClose={handleClose}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      BackdropProps={{
        sx: {
          boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
          backgroundColor: 'rgba(122, 130, 144, 0.45)',
        },
      }}
    >
      <Paper
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '80%',
          maxWidth: '1392px',
          height: '70%',
          maxHeight: '754px',
          borderRadius: '8px',
          boxShadow: '5px 5px 8px 0 rgba(0, 28, 71, 0.15)',
          border: 'solid 1px #ddd',
          p: '10px',
          pt: 0,
          backgroundColor: '#fff',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" m="20px" mr="10px">
          <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#141414' }}>{title}</Typography>
          <IconButton onClick={handleClose} sx={{ p: '10px' }}>
            <CloseIcon width="16" height="16" />
          </IconButton>
        </Stack>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
          }}
        >
          {children}
        </Box>
      </Paper>
    </Modal>
  );
};

export default ModalPopup;
