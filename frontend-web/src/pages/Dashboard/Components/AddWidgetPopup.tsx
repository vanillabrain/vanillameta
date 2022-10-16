import React, { useEffect, useRef, useState } from 'react';
import { BarChart, Dashboard, PieChart, MultilineChart } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  Alert,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { get } from '@/helpers/apiHelper';
import WidgetService from '@/api/widgetService';
import { STATUS } from '@/constant';

const iconType = item => {
  switch (item.toUpperCase()) {
    case 'CHART_BAR':
      return <BarChart />;
    case 'CHART_PIE':
      return <PieChart />;
    case 'CHART_LINE':
      return <MultilineChart />;
    default:
      return;
  }
};

function AddWidgetPopup({ label, useWidgetIds = [], widgetOpen = false, widgetSelect = null }) {
  const [open, setOpen] = useState(widgetOpen);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const getItems = () => {
    WidgetService.selectWidgetList().then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        const widgetList = response.data.data.filter(item => {
          return !useWidgetIds.find(useItem => useItem == item.id);
        });
        setLoadedWidgetData(widgetList);
      } else {
        console.log('조회실패!!!');
      }
    });
  };

  const descriptionElementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(widgetOpen);
  }, [widgetOpen]);

  useEffect(() => {
    if (open) {
      const { current: descriptionElement } = descriptionElementRef;
      if (descriptionElement !== null) {
        descriptionElement.focus();
      }

      setSelectedIds([]);
      setLoadedWidgetData([]);
      getItems();
    }
  }, [open]);

  const handleClose = () => {
    if (widgetSelect) {
      widgetSelect(null);
    }
    setOpen(false);
  };

  const handleClick = item => {
    const isSelect = isItemSelection(item);
    const newIds = [...selectedIds];
    if (isSelect) {
      const index = newIds.indexOf(item.id);
      newIds.splice(index, 1);
      setSelectedIds(newIds);
    } else {
      newIds.push(item.id);
      setSelectedIds(newIds);
    }
  };

  const isItemSelection = item => {
    return !!selectedIds.find(id => id === item.id);
  };

  const handleSelect = () => {
    const widgets = [];
    for (let i = 0; i < loadedWidgetData.length; i++) {
      if (selectedIds.indexOf(loadedWidgetData[i].id) > -1) {
        widgets.push(loadedWidgetData[i]);
      }
    }

    if (widgets.length > 0) {
      if (widgetSelect) {
        widgetSelect(widgets);
      }
      setOpen(false);
    } else {
      // todo alert 호출 "위젯을 선택하세요"
    }
  };

  return (
    <React.Fragment>
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
            추가할 위젯을 선택해주세요. {selectedIds.length}개
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
              <ListItemButton key={index} selected={isItemSelection(item)} onClick={() => handleClick(item)}>
                <ListItemIcon>{iconType(item.componentType)}</ListItemIcon>
                <ListItemText primary={item.title} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            취소
          </Button>
          <Button onClick={() => handleSelect()}>위젯 추가</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default AddWidgetPopup;
