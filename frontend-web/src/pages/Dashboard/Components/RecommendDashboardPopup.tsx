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
import CloseIcon from '@mui/icons-material/Close';
import { get } from '@/helpers/apiHelper';
import TemplateService from '@/api/templateService';
import WidgetService from '@/api/widgetService';

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

const templateIconType = item => {
  switch (item.toUpperCase()) {
    case 'CHART_BAR':
      return <BarChart />;
    case 'CHART_PIE':
      return <PieChart />;
    case 'CHART_LINE':
      return <MultilineChart />;
    default:
      return <MultilineChart />;
  }
};

export const WidgetList = ({ handleWidgetConfirm = null, handleWidgetCancel = null, selectedWidgetIds = [] }) => {
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [selectedIds, setSelectedIds] = useState(selectedWidgetIds);

  useEffect(() => {
    getItems();

    console.log('몇번 호출 되는거싱ㄴ가', selectedWidgetIds);
  }, []);

  useEffect(() => {
    setSelectedIds(selectedWidgetIds);
  }, [selectedWidgetIds]);

  const getItems = () => {
    WidgetService.selectWidgetList()
      .then(response => response.data)
      .then(data => setLoadedWidgetData(data));
  };

  const handleClick = item => {
    const isSelect = isItemSelection(item);
    const newIds = [...selectedIds];
    if (isSelect) {
      const index = newIds.indexOf(item.widgetId);
      newIds.splice(index, 1);
      setSelectedIds(newIds);
    } else {
      newIds.push(item.widgetId);
      setSelectedIds(newIds);
    }
  };

  const isItemSelection = item => {
    return !!selectedIds.find(widgetId => widgetId === item.widgetId);
  };

  // 취소 버튼 클릭
  const handleCancelClick = () => {
    if (handleWidgetCancel) {
      handleWidgetCancel();
    }
  };

  // 다음 버튼 클릭
  const handleConfirmClick = () => {
    const widgets = [];
    for (let i = 0; i < loadedWidgetData.length; i++) {
      if (selectedIds.indexOf(loadedWidgetData[i].widgetId) > -1) {
        widgets.push(loadedWidgetData[i]);
      }
    }

    if (widgets.length > 0) {
      if (handleWidgetConfirm) {
        handleWidgetConfirm(widgets);
      }
    } else {
      // todo alert 호출 "위젯을 선택하세요"
      alert('옴마! 위젯을 선택해야지');
    }
  };

  return (
    <React.Fragment>
      <DialogContent dividers id="scroll-dialog-description" tabIndex={-1} sx={{ p: 0 }}>
        <List
          sx={{
            width: 600,
            minWidth: 400,
            height: 500,
            minHeight: 300,
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
        <Button onClick={handleCancelClick} color="inherit">
          취소
        </Button>
        <Button onClick={handleConfirmClick}>다음</Button>
      </DialogActions>
    </React.Fragment>
  );
};

export const TemplateList = ({ handleWidgetConfirm = null, handleWidgetCancel = null, selectedWidgetIds = null }) => {
  const [loadedTemplateDataList, setLoadedTemplateDataList] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedItem, setSelectedItem] = useState(null);

  const getItems = () => {
    console.log('selectedWidgetIds : ', selectedWidgetIds);
    TemplateService.selectRecommendTemplateList({ widgets: selectedWidgetIds })
      .then(response => response.data)
      .then(data => setLoadedTemplateDataList(data));
  };

  useEffect(() => {
    setSelectedItem(null);
    setSelectedIndex(-1);
    getItems();
  }, []);

  // 취소 버튼 클릭
  const handleCancelClick = () => {
    if (handleWidgetCancel) {
      handleWidgetCancel();
    }
  };

  // 선택완료 버튼 클릭
  const handleConfirmClick = () => {
    // 선택된 템플릿을 대시보드에 넘겨준다.
    if (selectedItem) {
      if (handleWidgetConfirm) {
        handleWidgetConfirm(selectedItem);
      }
    } else {
      alert('으잉! 템플릿을 선택하라!');
    }
  };

  const handleClick = (item, index) => {
    setSelectedIndex(index);
    setSelectedItem(item);
  };

  return (
    <React.Fragment>
      <DialogContent dividers id="scroll-dialog-description" tabIndex={-1} sx={{ p: 0 }}>
        <List
          sx={{
            width: 600,
            minWidth: 400,
            height: 500,
            minHeight: 300,
          }}
        >
          {loadedTemplateDataList.map((item, index) => (
            <ListItemButton key={index} selected={index == selectedIndex} onClick={() => handleClick(item, index)}>
              <ListItemIcon>{templateIconType(item.componentType)}</ListItemIcon>
              <ListItemText primary={item.title} />
              <ListItemText primary={item.description} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelClick} color="inherit">
          뒤로가기
        </Button>
        <Button onClick={handleConfirmClick}>선택완료</Button>
      </DialogActions>
    </React.Fragment>
  );
};

function RecommendDashboardPopup({ recommendOpen = false, handleComplete = null }) {
  const [open, setOpen] = useState(recommendOpen);
  const [title, setTitle] = useState('대시보드 추천 생성');
  const [subTitle, setSubTitle] = useState('위젯을 선택하세요');
  const [step, setStep] = useState(1);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);

  useEffect(() => {
    setOpen(recommendOpen);
  }, [recommendOpen]);

  useEffect(() => {
    if (open) {
      setStep(1);
    }
  }, [open]);

  useEffect(() => {
    if (step == 1) {
      setSubTitle('위젯을 선택하세요');
    } else if (step == 2) {
      setSubTitle('템플릿을 선택하세요');
    }
  }, [step]);

  // 창 닫기
  const handleClose = () => {
    setOpen(false);
  };

  // 취소 버튼
  const handleCancelClick = () => {
    if (step == 1) {
      // 위젯 선택화면에서 다음 버튼 클릭
      handleClose();
    } else if (step == 2) {
      // 템플릿 선택화면에서 완료 클릭
      setStep(1); // step 1 로 이동
    }
  };

  // 다음 버튼
  const handleConfirmClick = items => {
    if (step == 1) {
      // 위젯 선택화면에서 다음 버튼 클릭
      const tempIds = [];
      items.map(item => {
        tempIds.push(item.widgetId);
      });

      setSelectedWidgetIds(tempIds);
      setStep(2); // step 2 로 이동
    } else if (step == 2) {
      // 템플릿 선택화면에서 완료 클릭
      // todo 대시보드에 layout, widgets 정보 전달
      if (handleComplete) {
        getTemplateResult(items);
      }
    }
  };

  const getTemplateResult = item => {
    console.log('aaa');
    get('/data/dummyDashboardInfo.json')
      .then(response => response.data)
      .then(data => handleComplete(data));
  };

  return (
    <React.Fragment>
      <Dialog open={open} aria-labelledby="scroll-dialog-title" aria-describedby="scroll-dialog-description">
        <DialogTitle id="scroll-dialog-title">
          {title}
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
            {subTitle}
          </Typography>
        </DialogTitle>
        {step == 1 ? (
          <WidgetList
            handleWidgetConfirm={handleConfirmClick}
            handleWidgetCancel={handleCancelClick}
            selectedWidgetIds={selectedWidgetIds}
          />
        ) : (
          <TemplateList
            handleWidgetConfirm={handleConfirmClick}
            handleWidgetCancel={handleCancelClick}
            selectedWidgetIds={selectedWidgetIds}
          />
        )}
        ;
      </Dialog>
    </React.Fragment>
  );
}
export default RecommendDashboardPopup;
