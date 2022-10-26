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
  Grid,
  Box,
  Stack,
} from '@mui/material';
import { useAlert } from 'react-alert';
import CloseIcon from '@mui/icons-material/Close';
import { get } from '@/helpers/apiHelper';
import TemplateService from '@/api/templateService';
import WidgetService from '@/api/widgetService';
import { STATUS } from '@/constant';
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
  const alert = useAlert();
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
    WidgetService.selectWidgetList().then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        setLoadedWidgetData(response.data.data);
      } else {
        console.log('조회 실패!!!!');
      }
    });
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
      if (selectedIds.indexOf(loadedWidgetData[i].id) > -1) {
        widgets.push(loadedWidgetData[i]);
      }
    }

    if (widgets.length > 0) {
      if (handleWidgetConfirm) {
        handleWidgetConfirm(widgets);
      }
    } else {
      alert.info('위젯을 선택하세요.');
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
  const alert = useAlert();
  const [loadedTemplateDataList, setLoadedTemplateDataList] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedItem, setSelectedItem] = useState(null);

  const getItems = () => {
    TemplateService.selectRecommendTemplateList({ widgets: selectedWidgetIds }).then(response => {
      // TemplateService.selectRecommendTemplateList({ widgets: [1, 2] }).then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        setLoadedTemplateDataList(response.data.data);
      } else {
        console.log('조회 실패!!');
      }
    });
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
      alert.info('템플릿을 선택하세요.');
    }
  };

  const handleClick = (item, index) => {
    setSelectedIndex(index);
    setSelectedItem(item);
  };

  return (
    <>
      <DialogContent dividers id="scroll-dialog-description" sx={{ width: '100%', height: '620px', padding: 0 }}>
        {/*<List*/}
        {/*  sx={{*/}
        {/*    width: 600,*/}
        {/*    minWidth: 400,*/}
        {/*    height: 500,*/}
        {/*    minHeight: 300,*/}
        {/*  }}*/}
        {/*>*/}
        {/*  {loadedTemplateDataList.map((item, index) => (*/}
        {/*    <ListItemButton key={index} selected={index == selectedIndex} onClick={() => handleClick(item, index)}>*/}
        {/*      /!*<ListItemIcon>{templateIconType(item.componentType)}</ListItemIcon>*!/*/}
        {/*      <ListItemText primary={item.title} />*/}
        {/*      <ListItemText primary={item.description} />*/}
        {/*    </ListItemButton>*/}
        {/*  ))}*/}
        {/*</List>*/}
        <Grid container columns={{ xs: 10 }} spacing="24px" sx={{ padding: '24px' }}>
          {loadedTemplateDataList.map((item, index) => (
            <Grid item xs={2}>
              <Stack
                justifyContent="center"
                alignItems="center"
                direction="column"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 12px 20px',
                  backgroundColor: '#eeeeee',
                }}
              >
                <Box sx={{ width: '224px', height: '146px', margin: '0 0 0', backgroundColor: '#0000ff' }}>이미지 자리</Box>
                <span
                  style={{
                    height: '20px',
                    flexGrow: '0',
                    fontFamily: 'Pretendard',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    fontStretch: 'normal',
                    fontStyle: 'normal',
                    lineHeight: '1.43',
                    letterSpacing: 'normal',
                    textAlign: 'left',
                    color: '#333333',
                  }}
                >
                  {item.title}
                </span>
                <span
                  style={{
                    height: '44px',
                    flexGrow: '0',
                    fontFamily: 'Pretendard',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    fontStretch: 'normal',
                    fontStyle: 'normal',
                    lineHeight: '1.57',
                    letterSpacing: 'normal',
                    textAlign: 'left',
                    color: '#767676',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '224px',
                    // whiteSpace: 'nowrap',
                  }}
                >
                  {item.description}
                </span>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelClick} color="inherit">
          뒤로가기
        </Button>
        <Button onClick={handleConfirmClick}>선택완료</Button>
      </DialogActions>
    </>
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
        tempIds.push(item.id);
      });

      setSelectedWidgetIds(tempIds);
      setStep(2); // step 2 로 이동
    } else if (step == 2) {
      // 템플릿 선택화면에서 완료 클릭
      // todo 대시보드에 layout, widgets 정보 전달
      if (handleComplete) {
        const item = {
          templateId: items.id,
          widgets: selectedWidgetIds,
        };
        getTemplateResult(item);
      }
    }
  };

  const getTemplateResult = item => {
    console.log('aaa');
    TemplateService.selectRecommendTemplateListDashboard(item).then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        handleComplete(response.data.data);
      } else {
        console.log('조회 실패!!');
      }
    });
  };

  return (
    <>
      {step == 1 ? (
        <Dialog
          open={open}
          aria-labelledby="scroll-dialog-title"
          aria-describedby="scroll-dialog-description"
          fullWidth={true}
          sx={{
            '& .MuiDialog-container': {
              '& .MuiPaper-root': {
                width: '100%',
                maxWidth: '600px', // Set your width here
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
              {title}
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
              {subTitle}
            </Typography>
          </DialogTitle>
          <WidgetList
            handleWidgetConfirm={handleConfirmClick}
            handleWidgetCancel={handleCancelClick}
            selectedWidgetIds={selectedWidgetIds}
          />
        </Dialog>
      ) : (
        <Dialog
          open={open}
          aria-labelledby="scroll-dialog-title"
          aria-describedby="scroll-dialog-description"
          fullWidth={true}
          sx={{
            '& .MuiDialog-container': {
              '& .MuiPaper-root': {
                width: '100%',
                maxWidth: '1392px', // Set your width here
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
              {title}
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
              {subTitle}
            </Typography>
          </DialogTitle>
          <TemplateList
            handleWidgetConfirm={handleConfirmClick}
            handleWidgetCancel={handleCancelClick}
            selectedWidgetIds={selectedWidgetIds}
          />
        </Dialog>
      )}
    </>
  );
}
export default RecommendDashboardPopup;
