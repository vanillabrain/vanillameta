import React, { useEffect, useRef, useState } from 'react';
import { BarChart, Dashboard, PieChart } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { get } from '@/helpers/apiHelper';

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

function AddWidgetPopupButton({ label, widgetSelect }) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(1);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);

  const getItems = () => {
    get('/data/dummyWidgetList.json')
      .then(response => response.data)
      .then(data => setLoadedWidgetData(data));
  };

  const descriptionElementRef = useRef<HTMLElement>(null);

  const handleOpenClick = () => {
    console.log('핸들 오픈 클릭');
    getItems();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleClick = index => {
    setSelectedIndex(index);
  };

  const handleDoubleClick = item => {
    handleSelect(item);
  };

  const handleSelect = item => {
    widgetSelect(item);
    handleClose();
  };

  useEffect(() => {
    if (open) {
      const { current: descriptionElement } = descriptionElementRef;
      if (descriptionElement !== null) {
        descriptionElement.focus();
      }
    }
  }, [open]);

  return (
    <React.Fragment>
      <Button onClick={handleOpenClick} variant="contained" endIcon={<AddIcon />} color="primary">
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        // scroll={scroll}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
      >
        <DialogTitle id="scroll-dialog-title">
          {label}
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
          <Typography variant="body2" mt={1}>
            추가할 위젯을 선택해주세요.
          </Typography>
        </DialogTitle>

        <DialogContent dividers id="scroll-dialog-description" ref={descriptionElementRef} tabIndex={-1} sx={{ p: 0 }}>
          <List
            sx={{
              width: '40%',
              minWidth: 400,
              height: '60%',
              minHeight: 300,
              maxHeight: 300,
            }}
          >
            {loadedWidgetData.map((item, index) => (
              <ListItemButton
                key={index}
                selected={selectedIndex == index}
                onClick={() => handleClick(index)}
                onDoubleClick={() => handleDoubleClick(item)}
              >
                <ListItemIcon>{iconType(item.type)}</ListItemIcon>
                <ListItemText primary={item.name} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            취소
          </Button>
          <Button onClick={() => handleSelect(loadedWidgetData[selectedIndex])}>위젯 추가</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default AddWidgetPopupButton;
