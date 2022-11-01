import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import WidgetService from '@/api/widgetService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import CloseButton from '@/components/button/CloseButton';

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
      <Dialog open={open} onClose={handleClose} fullWidth={true}>
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
              mr: '12px',
              mt: '12px',
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
                <ListItemIcon
                  sx={{
                    minWidth: '24px',
                    marginLeft: '16px',
                  }}
                >
                  <Avatar
                    src={`/static/images/${item.icon}`}
                    sx={{
                      width: 'auto',
                      height: '30px',
                      borderRadius: 0,
                      objectFit: 'contain',
                      backgroundColor: 'transparent',
                    }}
                  />
                </ListItemIcon>
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
