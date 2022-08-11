import React from 'react';
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
} from '@mui/material';
import { Close } from '@mui/icons-material';

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

function ModalButton(props) {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  const handleSelect = data => {
    console.log(data);
  };

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

  return (
    <React.Fragment>
      <Button onClick={handleOpen} variant="contained" endIcon={<Add />} color="primary">
        {props.label}
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Paper
          elevation={1}
          sx={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            right: 0,
            left: 0,
            m: 'auto',
            width: '40%',
            minWidth: 400,
            height: '60%',
            minHeight: 500,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <AppBar sx={{ position: 'relative', mb: 1 }} elevation={0}>
            <Toolbar>
              <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="close">
                <Close />
              </IconButton>
              <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                {props.label}
              </Typography>
              <Button color="inherit" onClick={handleClose}>
                취소
              </Button>
              <Button autoFocus color="primary" onClick={handleClose}>
                저장
              </Button>
            </Toolbar>
            <Divider />
          </AppBar>

          <List disablePadding>
            {postList.map(item => (
              <ListItem key={item.id}>
                <ListItemButton onClick={handleSelect}>
                  <ListItemIcon>{iconType(item.type)}</ListItemIcon>
                  <ListItemText primary={item.title} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Modal>
    </React.Fragment>
  );
}

export default ModalButton;
