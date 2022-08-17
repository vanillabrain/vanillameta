import React, { useState } from 'react';
import {
  IconButton,
  Dialog,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Slide,
  DialogTitle,
  Grid,
  Stack,
  Box,
  DialogActions,
  TextField,
  DialogContent,
  DialogContentText,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ConfirmButton from '../../../components/button/ConfirmButton';
import RecommendTable from './RecommendTable';
import PageTitleBox from '@/components/PageTitleBox';

const dataSource = [
  { key: 0, label: '데이터베이스 1', value: '데이터베이스 1' },
  { key: 1, label: '데이터베이스 2', value: '데이터베이스 2' },
  { key: 2, label: '데이터베이스 3', value: '데이터베이스 3' },
];
const dataSet = [
  { key: 0, label: '데이터 셋 1', value: '데이터 셋 1' },
  { key: 1, label: '데이터 셋 2', value: '데이터 셋 2' },
  { key: 2, label: '데이터 셋 3', value: '데이터 셋 3' },
  { key: 3, label: '데이터 셋 4', value: '데이터 셋 4' },
  { key: 4, label: '데이터 셋 5', value: '데이터 셋 5' },
];

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function Recommend(props) {
  const [open, setOpen] = useState(false);
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [selectedData, setSelectedData] = useState('');

  const [isNextSlide, setIsNextSlide] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSlideToggleClick = () => {
    if (!isNextSlide) {
      setIsNextSlide(true);
    } else {
      setIsNextSlide(false);
    }
  };

  const handleCreateClick = () => {
    setOpenFormDialog(true);
  };
  const handleCreateClose = () => {
    setIsNextSlide(false);
    setOpenFormDialog(false);
    setOpen(false);
  };

  return (
    <React.Fragment>
      <IconButton autoFocus onClick={handleClickOpen} size="small">
        <AutoAwesomeIcon />
      </IconButton>
      <Dialog open={open} onClose={handleClose} TransitionComponent={Transition} fullWidth maxWidth="xl">
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              대시보드 생성
            </Typography>
          </Toolbar>
        </AppBar>
        {!isNextSlide ? (
          <RecommendTable dataSource={dataSource} dataSet={dataSet} />
        ) : (
          <Stack p={4} pb={0} spacing={3}>
            <Typography variant="h6" component="p">
              Layout1
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: '46.875vw',
                maxHeight: 'calc(70vh - 200px)',
                m: 'auto',
                borderRadius: 1,
                backgroundColor: '#eee',
              }}
            />
          </Stack>
        )}

        <DialogActions sx={{ px: 4, pb: 3 }}>
          <ConfirmButton
            confirmLabel={!isNextSlide ? '다음' : '대시보드 생성'}
            cancelLabel={!isNextSlide ? '취소' : '이전'}
            confirm={!isNextSlide ? { disabled: false, onClick: handleSlideToggleClick } : { onClick: handleCreateClick }}
            cancel={!isNextSlide ? {} : { onClick: handleSlideToggleClick }}
          />
          <Dialog open={openFormDialog} onClose={handleClose}>
            <DialogTitle>대시보드 생성</DialogTitle>
            <DialogContent>
              <DialogContentText>생성할 대시보드의 이름을 작성해주세요.</DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                id="dashboardName"
                label="대시보드 이름"
                type="text"
                fullWidth
                variant="standard"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCreateClose}>취소</Button>
              <Button onClick={handleCreateClose}>대시보드 생성</Button>
            </DialogActions>
          </Dialog>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Recommend;
