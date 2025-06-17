import React, { useContext, useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useAlert } from 'react-alert';
import TemplateService from '@/api/templateService';
import WidgetService from '@/api/widgetService';
import { MAX_WIDTH, STATUS } from '@/constant';
import CloseButton from '@/components/button/CloseButton';
import LazyImage from '@/components/LazyImage';
import LazyIcon from '@/components/LazyIcon';
import { LoadingContext } from '@/contexts/LoadingContext';

const getTemplateIcon = id => {
  const templateMap = {
    7: 'template01',
    8: 'template02', 
    9: 'template03',
    10: 'template04',
    11: 'template05',
    12: 'template06',
    13: 'template07',
    14: 'template08',
    15: 'template09',
    16: 'template10',
  };

  const iconName = templateMap[id];
  if (!iconName) return null;

  return (
    <LazyIcon 
      iconName={iconName}
      width="100%"
      height="100%"
    />
  );
};

export const WidgetList = ({
  handleWidgetConfirm = null,
  handleWidgetCancel = null,
  selectedWidgetIds = [],
  selectedChange = null,
}) => {
  const alert = useAlert();
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [selectedIds, setSelectedIds] = useState(selectedWidgetIds);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  useEffect(() => {
    getItems();
  }, []);

  useEffect(() => {
    setSelectedIds(selectedWidgetIds);
  }, [selectedWidgetIds]);

  useEffect(() => {
    selectedChange(selectedIds.length);
  }, [selectedIds]);

  const getItems = () => {
    showLoading();
    WidgetService.selectWidgetList()
      .then(response => {
        console.log('selectWidget response:', response);
        if (response.status === STATUS.SUCCESS) {
          setLoadedWidgetData(response.data);
        } else {
          console.log('조회 실패!!!!');
        }
      })
      .finally(() => {
        hideLoading();
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
      alert.info('위젯을 선택해주세요.');
    }
  };

  return (
    <>
      <DialogContent dividers id="scroll-dialog-description" tabIndex={-1} sx={{ p: 0 }}>
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
              onClick={() => handleClick(item)}
              sx={{ paddingX: '20px', height: '50px' }}
            >
              <Checkbox checked={isItemSelection(item)} />
              <ListItemIcon
                sx={{
                  minWidth: '24px',
                  marginLeft: '16px',
                }}
              >
                <LazyImage
                  src={`/static/images/${item.icon}`}
                  alt={`${item.title} 아이콘`}
                  width="auto"
                  height="30px"
                  objectFit="contain"
                  style={{
                    backgroundColor: 'transparent',
                  }}
                  threshold={0.1}
                  rootMargin="100px"
                />
              </ListItemIcon>
              <ListItemText
                primaryTypographyProps={{
                  sx: {
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  },
                }}
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
          onClick={handleCancelClick}
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
        <span style={{ width: '4px' }} />
        <Button
          onClick={() => handleConfirmClick()}
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
          다음
        </Button>
      </DialogActions>
    </>
  );
};

export const TemplateList = ({ handleWidgetConfirm = null, handleWidgetCancel = null, selectedWidgetIds = null }) => {
  const alert = useAlert();
  const [loadedTemplateDataList, setLoadedTemplateDataList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  const getItems = () => {
    TemplateService.selectRecommendTemplateList({ databaseIds: selectedWidgetIds }).then(response => {
      // TemplateService.selectRecommendTemplateList({ widgets: [1, 2] }).then(response => {
      console.log('selectTemplateList response:', response);
      if (response.status === STATUS.SUCCESS) {
        setLoadedTemplateDataList(response.data.templates || response.data.items || []);
      } else {
        console.log('조회 실패!!');
      }
    });
  };

  useEffect(() => {
    setSelectedItem(null);
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
      alert.info('템플릿을 선택해주세요.');
    }
  };

  const handleItemClick = item => {
    setSelectedItem(item);
  };

  return (
    <>
      <DialogContent dividers id="scroll-dialog-description" sx={{ width: '100%', height: '602px', padding: '24px' }}>
        <Grid container columns={{ xs: 10 }} spacing="24px" sx={{ height: '100%' }}>
          {loadedTemplateDataList.map(item => {
            const selected = selectedItem?.id === item.id;
            return (
              <Grid item xs={2}>
                <Stack
                  justifyContent="center"
                  alignItems="center"
                  direction="column"
                  sx={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    height: '266px',
                    gap: '12px',
                    padding: '12px 12px 20px',
                    backgroundColor: selected ? '#edf8ff' : '#f5f6f8',
                    borderRadius: '6px',
                    position: 'relative',
                    border: selected ? 'solid 1px #0f5ab2' : 'solid 1px #f5f6f8',
                    '&:hover': {
                      background: '#ebfbff',
                    },
                  }}
                  onClick={() => handleItemClick(item)}
                >
                  <Box sx={{ width: '100%', margin: 0 }}>{getTemplateIcon(item.id)}</Box>
                  {selected ? (
                    <LazyIcon 
                      iconName="ic-check"
                      width="33px"
                      height="28px"
                      style={{ position: 'absolute', right: '20px', top: '20px' }}
                    />
                  ) : (
                    <></>
                  )}

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
                      color: selected ? '#0f5ab2' : '#333333',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '224px',
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
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
                      fontWeight: 'normal',
                      fontStretch: 'normal',
                      fontStyle: 'normal',
                      lineHeight: '1.57',
                      letterSpacing: 'normal',
                      textAlign: 'left',
                      color: '#767676',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.description}
                  </span>
                </Stack>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ height: '63px' }}>
        <Button
          onClick={handleCancelClick}
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
          뒤로가기
        </Button>
        <span style={{ width: '4px' }} />
        <Button
          onClick={() => handleConfirmClick()}
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
          선택완료
        </Button>
      </DialogActions>
    </>
  );
};

function RecommendDashboardPopup({ recommendOpen = false, handleComplete = null }) {
  const [open, setOpen] = useState(recommendOpen);
  const title = '대시보드 추천 생성';
  const [subTitle, setSubTitle] = useState('위젯을 선택하세요');
  const [step, setStep] = useState(1);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);
  const [selectedWidgetCount, setSelectedWidgetCount] = useState(0);
  const [dialogWidth, setDialogWidth] = useState('600px');

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
      setDialogWidth('600px');
    } else if (step == 2) {
      setSubTitle('템플릿을 선택하세요');
      setDialogWidth(MAX_WIDTH);
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

  const selectedWidgetChange = count => {
    setSelectedWidgetCount(count);
  };

  const getTemplateResult = item => {
    TemplateService.selectRecommendTemplateListDashboard(item).then(response => {
      console.log('createTemplateDashboard response:', response);
      if (response.status === STATUS.SUCCESS) {
        handleComplete(response.data);
      } else {
        console.log('조회 실패!!');
      }
    });
  };

  return (
    <Dialog
      open={open}
      // fullWidth={true}
      // maxWidth={false}
      sx={{
        '& .MuiDialog-container': {
          '& .MuiPaper-root': {
            width: '100%',
            maxWidth: dialogWidth, // Set your width here
          },
        },
      }}
    >
      <DialogTitle id="scroll-dialog-title" sx={{ width: '100%', paddingLeft: '21px', paddingTop: '13px', height: '87px' }}>
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
            marginRight: '12px',
            marginTop: '12px',
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
          {step == 1 ? (
            <>
              <span>추가할 위젯을 선택해주세요. (</span>
              <span style={{ color: '#0f5ab2', fontWeight: 'bold' }}>{selectedWidgetCount}</span>
              <span>개 선택)</span>
            </>
          ) : (
            subTitle
          )}
        </Typography>
      </DialogTitle>
      {step == 1 ? (
        <WidgetList
          handleWidgetConfirm={handleConfirmClick}
          handleWidgetCancel={handleCancelClick}
          selectedWidgetIds={selectedWidgetIds}
          selectedChange={selectedWidgetChange}
        />
      ) : (
        <TemplateList
          handleWidgetConfirm={handleConfirmClick}
          handleWidgetCancel={handleCancelClick}
          selectedWidgetIds={selectedWidgetIds}
        />
      )}
    </Dialog>
  );
}
export default RecommendDashboardPopup;
