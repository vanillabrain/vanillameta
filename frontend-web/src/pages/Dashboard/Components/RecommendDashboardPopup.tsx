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
import { STATUS } from '@/constant';
import CloseButton from '@/components/button/CloseButton';
import { ReactComponent as TemplateIcon01 } from '@/assets/images/template/template01.svg';
import { ReactComponent as TemplateIcon02 } from '@/assets/images/template/template02.svg';
import { ReactComponent as TemplateIcon03 } from '@/assets/images/template/template03.svg';
import { ReactComponent as TemplateIcon04 } from '@/assets/images/template/template04.svg';
import { ReactComponent as TemplateIcon05 } from '@/assets/images/template/template05.svg';
import { ReactComponent as TemplateIcon06 } from '@/assets/images/template/template06.svg';
import { ReactComponent as TemplateIcon07 } from '@/assets/images/template/template07.svg';
import { ReactComponent as TemplateIcon08 } from '@/assets/images/template/template08.svg';
import { ReactComponent as TemplateIcon09 } from '@/assets/images/template/template09.svg';
import { ReactComponent as TemplateIcon10 } from '@/assets/images/template/template10.svg';
import { ReactComponent as CheckIcon } from '@/assets/images/icon/ic-check.svg';
import { LoadingContext } from '@/contexts/LoadingContext';

const getTemplateIcon = id => {
  let icon = null;
  switch (id) {
    case 7:
      icon = <TemplateIcon01 style={{ width: '100%', height: '100%' }} />;
      break;
    case 8:
      icon = <TemplateIcon02 style={{ width: '100%', height: '100%' }} />;
      break;
    case 9:
      icon = <TemplateIcon03 style={{ width: '100%', height: '100%' }} />;
      break;
    case 10:
      icon = <TemplateIcon04 style={{ width: '100%', height: '100%' }} />;
      break;
    case 11:
      icon = <TemplateIcon05 style={{ width: '100%', height: '100%' }} />;
      break;
    case 12:
      icon = <TemplateIcon06 style={{ width: '100%', height: '100%' }} />;
      break;
    case 13:
      icon = <TemplateIcon07 style={{ width: '100%', height: '100%' }} />;
      break;
    case 14:
      icon = <TemplateIcon08 style={{ width: '100%', height: '100%' }} />;
      break;
    case 15:
      icon = <TemplateIcon09 style={{ width: '100%', height: '100%' }} />;
      break;
    case 16:
      icon = <TemplateIcon10 style={{ width: '100%', height: '100%' }} />;
      break;
  }
  return icon;
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
        if (response.data.status == STATUS.SUCCESS) {
          setLoadedWidgetData(response.data.data);
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
                    <CheckIcon style={{ width: '33px', height: '28px', position: 'absolute', right: '20px', top: '20px' }} />
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
      setDialogWidth('1392px');
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
      if (response.data.status == STATUS.SUCCESS) {
        handleComplete(response.data.data);
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
