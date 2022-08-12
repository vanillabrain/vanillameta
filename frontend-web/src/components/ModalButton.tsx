import React, { useState } from 'react';
import { Add, BarChart, Dashboard, PieChart } from '@mui/icons-material';
import {
  AppBar,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Modal,
  Toolbar,
  Typography,
  Paper,
  ListItemButton,
  ListItemIcon,
  Dialog,
  ListItemAvatar,
  Avatar,
  DialogTitle,
  DialogProps,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

const postList = [
  {
    id: 1,
    title: '위젯1',
    date: '22.08.04',
    type: 'dashboard',
  },
  {
    id: 2,
    title: '테스트 위젯 테스트 위젯',
    date: '22.08.04',
    type: 'barChart',
  },
  {
    id: 3,
    title: '테스트 대시보드',
    date: '22.08.04',
    type: 'pieChart',
  },
  {
    id: 4,
    title: '그래프 차트',
    date: '22.08.04',
    type: 'dashboard',
  },
  {
    id: 5,
    title: 'STARFLEET HEADQUARTERS ',
    date: '22.08.04',
    type: 'barChart',
  },
  {
    id: 6,
    title: 'IONIC CANNON ',
    date: '22.08.04',
    type: 'pieChart',
  },
  {
    id: 7,
    title: 'CORE ',
    date: '22.08.04',
    type: 'dashboard',
  },
  {
    id: 8,
    title: 'Advenas crescere!',
    date: '22.08.04',
    type: 'barChart',
  },
  {
    id: 9,
    title: '테스트 제목 테스트 제목 테스트 제목',
    date: '22.08.04',
    type: 'pieChart',
  },
  {
    id: 10,
    title: 'NANOMACHINE ',
    date: '22.08.04',
    type: 'barChart',
  },
  // {
  //   id: 11,
  //   title: '위젯3',
  //   date: '22.08.04',
  //   type: 'pieChart',
  // },
  // {
  //   id: 12,
  //   title: '위젯1',
  //   date: '22.08.04',
  //   type: 'dashboard',
  // },
  // {
  //   id: 13,
  //   title: '위젯2',
  //   date: '22.08.04',
  //   type: 'barChart',
  // },
  // {
  //   id: 14,
  //   title: '위젯3',
  //   date: '22.08.04',
  //   type: 'pieChart',
  // },
];

// export interface SimpleDialogProps {
//   open: boolean;
//   selectedValue: string;
//   onClose: (value: string) => void;
// }

// const [open, setOpen] = useState(false);
// const handleOpen = () => {
//   setOpen(true);
// };
// const handleClose = () => {
//   setOpen(false);
// };
// const handleSelect = data => {
//   console.log(data);
// };

const iconType = item => {
  switch (item) {
    case 'dashboard':
      return <Dashboard />;
    case 'barChart':
      return <BarChart />;
    case 'pieChart':
      return <PieChart />;
    default:
      return;
  }
};

function ModalButton(props) {
  const [open, setOpen] = useState(false);
  const [scroll, setScroll] = useState<DialogProps['scroll']>('paper');
  const [isSelected, setIsSelected] = useState(0);

  const handleClickOpen = (scrollType: DialogProps['scroll']) => () => {
    setOpen(true);
    setScroll(scrollType);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSelect = (value: number) => {
    setIsSelected(value);
    console.log(isSelected);
    // setOpen(false);
  };

  const descriptionElementRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (open) {
      const { current: descriptionElement } = descriptionElementRef;
      if (descriptionElement !== null) {
        descriptionElement.focus();
      }
    }
  }, [open]);

  return (
    <React.Fragment>
      <Button onClick={handleClickOpen('paper')} variant="contained" endIcon={<AddIcon />} color="primary">
        {props.label}
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        scroll={scroll}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
      >
        <DialogTitle id="scroll-dialog-title">
          {props.label}
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: theme => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="scroll-dialog-description" ref={descriptionElementRef} tabIndex={-1}>
            추가할 위젯을 선택해주세요.
          </DialogContentText>
        </DialogContent>
        <List
          sx={{
            p: 2,
            pt: 0,
            width: '40%',
            minWidth: 400,
            height: '60%',
            minHeight: 400,
          }}
        >
          {postList.map(item => (
            <ListItem
              button
              component="li"
              key={item.id}
              onClick={() => handleSelect(item.id)}
              sx={isSelected === item.id ? { p: 1, backgroundColor: '#eee', fontWeight: 500 } : { p: 1 }}
            >
              <ListItemIcon sx={isSelected === item.id && { color: '#000' }}>{iconType(item.type)}</ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 'inherit' }} primary={item.title} />
            </ListItem>
          ))}
        </List>
        {/*</DialogContentText>*/}
        {/*</DialogContent>*/}
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            취소
          </Button>
          <Button onClick={handleClose}>위젯 추가</Button>
        </DialogActions>
      </Dialog>

      {/*<Modal*/}
      {/*  open={open}*/}
      {/*  onClose={handleClose}*/}
      {/*  aria-labelledby="modal-modal-title"*/}
      {/*  aria-describedby="modal-modal-description"*/}
      {/*>*/}
      {/*  <Paper*/}
      {/*    elevation={1}*/}
      {/*    sx={{*/}
      {/*      position: 'fixed',*/}
      {/*      top: 0,*/}
      {/*      bottom: 0,*/}
      {/*      right: 0,*/}
      {/*      left: 0,*/}
      {/*      m: 'auto',*/}
      {/*      width: '40%',*/}
      {/*      minWidth: 400,*/}
      {/*      height: '60%',*/}
      {/*      minHeight: 500,*/}
      {/*      borderRadius: 3,*/}
      {/*      overflow: 'hidden',*/}
      {/*    }}*/}
      {/*  >*/}
      {/*    <AppBar sx={{ position: 'relative', mb: 1 }} elevation={0}>*/}
      {/*      <Toolbar>*/}
      {/*        <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="close">*/}
      {/*          <Close />*/}
      {/*        </IconButton>*/}
      {/*        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">*/}
      {/*          {props.label}*/}
      {/*        </Typography>*/}
      {/*        <Button color="inherit" onClick={handleClose}>*/}
      {/*          취소*/}
      {/*        </Button>*/}
      {/*        <Button autoFocus color="primary" onClick={handleClose}>*/}
      {/*          저장*/}
      {/*        </Button>*/}
      {/*      </Toolbar>*/}
      {/*      <Divider />*/}
      {/*    </AppBar>*/}

      {/*    <List disablePadding>*/}
      {/*      {postList.map(item => (*/}
      {/*        <ListItem key={item.id}>*/}
      {/*          <ListItemButton onClick={handleSelect}>*/}
      {/*            <ListItemIcon>{iconType(item.type)}</ListItemIcon>*/}
      {/*            <ListItemText primary={item.title} />*/}
      {/*          </ListItemButton>*/}
      {/*        </ListItem>*/}
      {/*      ))}*/}
      {/*    </List>*/}
      {/*  </Paper>*/}
      {/*</Modal>*/}
    </React.Fragment>
  );
}

export default ModalButton;
