import React, { useEffect, useRef, useState } from 'react';
import { BarChart, MultilineChart, PieChart } from '@mui/icons-material';
import {
  Button,
  Checkbox,
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
import CloseIcon from '@mui/icons-material/Close';
import WidgetService from '@/api/widgetService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import CloseButton from '@/components/button/CloseButton';

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
  const alert = useAlert();
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
      alert.info('위젯을 선택하세요.');
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        // scroll={scroll}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
        fullWidth={true}
        sx={{
          '& .MuiDialog-container': {
            '& .MuiPaper-root': {
              width: '100%',
              maxWidth: '600px', // Set your width here
              borderRadius: '8px',
              boxShadow: '5px 5px 8px 0 rgba(0, 28, 71, 0.15)',
              border: 'solid 1px #ddd',
            },
          },
        }}
      >
        <DialogTitle
          id="scroll-dialog-title"
          sx={{ width: '100%', paddingLeft: '21px', paddingTop: '13px', height: '87px' }}
        >
          <span
            style={{
              height: '24px',
              fontFamily: 'Pretendard',
              fontSize: '20px',
              fontWeight: '600',
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 'normal',
              letterSpacing: 'normal',
              textAlign: 'left',
              color: '#141414',
            }}
          >
            {label}
          </span>
          <CloseButton
            sx={{
              position: 'absolute',
              right: '0px',
              top: '0px',
              paddingRight: '18.9px',
              paddingTop: '20.4px',
              cursor: 'pointer',
            }}
            size="medium"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              handleClose();
            }}
          />
          <Typography
            variant="body2"
            sx={{
              height: '17px',
              flexGrow: 0,
              fontFamily: 'Pretendard',
              fontSize: '14px',
              fontWeight: 'normal',
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 'normal',
              letterSpacing: 'normal',
              textAlign: 'left',
              color: '#767676',
              paddingTop: '6px',
            }}
          >
            추가할 위젯을 선택해주세요. (<span style={{ color: '#0f5ab2', fontWeight: 'bold' }}>{selectedIds.length}</span>개
            선택)
          </Typography>
        </DialogTitle>

        <DialogContent dividers id="scroll-dialog-description" ref={descriptionElementRef} tabIndex={-1} sx={{ p: 0 }}>
          <List
            sx={{
              width: '100%',
              height: '400px',
            }}
          >
            {loadedWidgetData.map((item, index) => (
              <ListItemButton
                key={index}
                selected={isItemSelection(item)}
                sx={{ paddingX: '20px', height: '50px' }}
                onClick={() => handleClick(item)}
              >
                <Checkbox checked={isItemSelection(item)} />
                <ListItemIcon sx={{ marginLeft: '16px', minWidth: '24px' }}>{iconType(item.componentType)}</ListItemIcon>
                <ListItemText
                  sx={{
                    marginLeft: '16px',
                    fontFamily: 'Pretendard',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontStretch: 'normal',
                    fontStyle: 'normal',
                    lineHeight: 1.14,
                    letterSpacing: 'normal',
                    textAlign: 'left',
                    color: '#333333',
                  }}
                  primary={item.title}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>

        <DialogActions sx={{ height: '63px' }}>
          <Button
            onClick={handleClose}
            color="inherit"
            sx={{
              flexGrow: 0,
              fontFamily: 'Pretendard',
              fontSize: '14px',
              fontWeight: 600,
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 1.14,
              letterSpacing: 'normal',
              textAlign: 'left',
              color: '#767676',
            }}
          >
            취소
          </Button>
          <span style={{ width: '4px' }}></span>
          <Button
            onClick={() => handleSelect()}
            sx={{
              flexGrow: 0,
              fontFamily: 'Pretendard',
              fontSize: '14px',
              fontWeight: 600,
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 1.14,
              letterSpacing: 'normal',
              textAlign: 'left',
              color: '#0057bd',
            }}
          >
            위젯 추가
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AddWidgetPopup;
