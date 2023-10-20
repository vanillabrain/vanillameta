import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Card, CardHeader, Stack, TextField } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageTitleBox from '@/components/PageTitleBox';
import AddWidgetPopup from '@/pages/Dashboard/Components/AddWidgetPopup';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useAlert } from 'react-alert';
import { SnackbarContext } from '@/contexts/AlertContext';

import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import AddIcon from '@mui/icons-material/Add';
import RecommendDashboardPopup from '@/pages/Dashboard/Components/RecommendDashboardPopup';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import PageViewBox from '../../../components/PageViewBox';
import CloseButton from '@/components/button/CloseButton';
import bg from '@/assets/images/dashboard-bg.svg';
import { LoadingContext } from '@/contexts/LoadingContext';
import ModifyButton from '@/components/button/ModifyButton';
import ReloadButton from '@/components/button/ReloadButton';

const ResponsiveGridLayout = WidthProvider(Responsive);

function DashboardModify() {
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [dashboardId, setDashboardId] = useState(null); // dashboard id
  const [dashboardTitle, setDashboardTitle] = useState(''); // dashboard 제목
  const [widgets, setWidgets] = useState([]); // widget 정보
  const [layout, setLayout] = useState([]); // layout 정보
  const [topTitle, setTopTitle] = useState('대시보드');
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const useWidgetIds = [];
  const dashboardInfo = {
    dashboardId: null,
    title: '',
    layout: [],
    widgets: [],
  };

  // init useEffect
  useEffect(() => {
    console.log("searchParams.get('createType') : ", searchParams.get('createType'));
    // create 와 modify 에 따라 초기 설정을 변경
    if (searchParams.get('createType') != null) {
      if (searchParams.get('createType') == 'recommend') {
        setRecommendOpen(true); // 추천 프로세스 시작
      } else {
        // create
        handleWidgetOpen(); // 신규 생성 프로세스 시작
      }
    } else {
      if (searchParams.get('id') != null) {
        setDashboardId(searchParams.get('id'));
        getDashboardInfo(searchParams.get('id'));
      }
    }
    setTopTitle(searchParams.get('id') == null ? '대시보드 추가' : '대시보드 수정');
  }, []);

  // dashboard info 조회
  const getDashboardInfo = id => {
    showLoading();
    DashboardService.selectDashboard(id)
      .then(response => {
        if (response.data.status == STATUS.SUCCESS) {
          setDashboardTitle(response.data.data.title);
          setWidgets(response.data.data.widgets);

          response.data.data.layout.map(item => {
            if (item.i !== undefined) {
              item.i = item.i.toString();
            }
          });
          setLayout(response.data.data.layout);
        } else {
          alert.error('대시보드 조회에 실패했습니다.\n다시 시도해 주세요.');
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  useEffect(() => {
    // 여기서 처리
    if (widgets.length > 0) {
      console.log(widgets);
    }
  }, [widgets]);

  // 현재 위젯 선택창에서 선택된 위젯 목록 callback
  const handleWidgetSelect = items => {
    setWidgetOpen(false);
    if (items != null) {
      setWidgets([...widgets, ...items]);
    }
  };

  // 레이아웃 변경 이벤트
  const onLayoutChange = changeLayout => {
    console.log('레이아웃이 바꼇어요');
    setLayout(changeLayout);
  };

  // 추가 할 layout
  // @tempLayout 현재 배치되어 있는 layout 정보
  // @x : 새로 배치될 위젯의 x 초기값
  // @y : 새로 배치될 위젯의 y 초기값
  // @w : 새로 배치될 위젯의 width 값
  // @h : 새로 배치될 위젯의 height 값
  const getCalculatorPosition = (tempLayout, x = 0, y = 0, w = 6, h = 5, layoutMaxW = 12) => {
    const tempPos = { startX: x, endX: w - 1, startY: y, endY: h - 1 }; // layout 계산을 위한 값 보정
    tempLayout.sort((a, b) => a.y - b.y || a.x - b.x);

    const tmepPosArr = [];
    tempLayout.map(item => {
      tmepPosArr.push({ startX: item.x, endX: item.x + item.w - 1, startY: item.y, endY: item.y + item.h - 1 }); // layout 계산을 위한 값 보정
    });

    // layout 위치 계산 (재귀함수로 사용. 해당 함수를 수정할 때 무한 loop 되지 않게 조심할 것)
    const calculator = (pos, posArr) => {
      const maxW = layoutMaxW - 1; // layout 계산을 위한 값 보정

      // 추가할 위젯의 위치를 1칸씩 변경
      const getCalculatorPos = pos => {
        if (pos.endX + 1 > maxW) {
          pos.endX = pos.endX - pos.startX;
          pos.startX = 0;
          pos.startY = pos.startY + 1;
          pos.endY = pos.endY + 1;
        } else {
          pos.startX = pos.startX + 1;
          pos.endX = pos.endX + 1;
        }
        return pos;
      };

      for (let i = 0; i < posArr.length; i++) {
        const item = posArr[i];
        let isCompareHit = false;
        if (pos.startX <= item.startX && (pos.endX >= item.startX || pos.endX > item.endX)) {
          // x 좌표가 겹치는 상황
          isCompareHit = true;
        } else if (pos.startX >= item.startX && pos.startX <= item.endX) {
          // x 좌표가 겹치는 상황
          isCompareHit = true;
        }

        if (isCompareHit) {
          if (pos.startY <= item.startY && (pos.endY >= item.startY || pos.endY > item.endY)) {
            // x, y 좌표가 겹치는 상황
            return calculator(getCalculatorPos(pos), posArr);
          } else if (pos.startY >= item.startY && pos.startY <= item.endY) {
            // x, y 좌표가 겹치는 상황
            return calculator(getCalculatorPos(pos), posArr);
          }
        }
      }

      return pos;
    };

    const resultPos = calculator(tempPos, tmepPosArr);
    // 보정된 layout 값을 원래대로 복원
    return {
      x: resultPos.startX,
      y: resultPos.startY,
      w: resultPos.endX - resultPos.startX + 1,
      h: resultPos.endY - resultPos.startY + 1,
    };
  };

  // widget 생성
  const generateWidget = () => {
    useWidgetIds.length = 0;
    const addLayouts = [];

    widgets.map((item, index) => {
      if (layout.length <= index) {
        const calculatorPosition = getCalculatorPosition([...layout, ...addLayouts], 0, 0, 6, 5, 12);

        addLayouts.push({
          i: item.id.toString(),
          ...calculatorPosition,
        });
      }
    });

    const handleModifyDataClick = item => {
      if (item?.datasetType == 'DATASET') {
        navigate(`/data/set/modify/${item.datasetId}`);
      } else {
        alert.info('데이터베이스 테이블 입니다.');
      }
    };

    const handleModifyWidgetClick = item => {
      // navigate(`/widget/${item.id}`); //view
      navigate(`/widget/modify?id=${item.id}`); //edit
    };

    if (addLayouts.length > 0) {
      setLayout([...layout, ...addLayouts]);
    }

    return widgets.map(item => {
      useWidgetIds.push(item.id); // 현재 widget id 를 담는다.
      return (
        <Card
          key={item.id}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
            border: 'solid 1px #e2e2e2',
            backgroundColor: '#fff',
          }}
        >
          <ReloadButton
            sx={{
              position: 'absolute',
              right: '76px',
              top: '6px',
              zIndex: 2000,
            }}
            onClick={event => {
              console.log(item);
              event.preventDefault();
              event.stopPropagation();
              handleModifyDataClick(item);
            }}
          />
          <ModifyButton
            sx={{
              position: 'absolute',
              right: '40px',
              top: '6px',
              zIndex: 2000,
            }}
            onClick={event => {
              console.log(item);
              event.preventDefault();
              event.stopPropagation();
              handleModifyWidgetClick(item);
            }}
          />
          <CloseButton
            sx={{
              position: 'absolute',
              right: '0px',
              top: '0px',
              marginRight: '9px',
              marginTop: '9px',
              paddingRight: '8px',
              paddingTop: '8px',
              cursor: 'pointer',
              zIndex: 2000,
            }}
            size="medium"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();

              const tempWidgets = [...widgets];
              const tempLayout = [...layout];
              const index = widgets.findIndex(widgetItem => widgetItem.id == item.id);
              if (index > -1) {
                tempWidgets.splice(index, 1);
                tempLayout.splice(index, 1);
                setLayout([...tempLayout]);
                setWidgets([...tempWidgets]);
              }
            }}
          />
          <WidgetWrapper widgetOption={item} dataSetId={item.datasetId} />
        </Card>
      );
    });
  };

  // 저장 여부 버튼 이벤트
  const handleSaveDialogSelect = () => {
    // validation 체크
    // title null 체크, widgets 수 체크 (0개면 저장 못함)
    if (dashboardTitle == null || dashboardTitle.trim() == '') {
      // title 이 없을 경우
      alert.info('제목을 입력해주세요.');
    } else if (layout.length == 0 || widgets.length == 0) {
      // 배치된 widget 이 없을경우
      alert.info('배치된 위젯이 없습니다.');
    } else {
      // 저장 전 react grid layout 에서 필요없는 속성 제거
      layout.map(item => {
        delete item.moved;
        delete item.static;
      });

      // 저장 로직
      dashboardInfo.dashboardId = dashboardId;
      dashboardInfo.title = dashboardTitle;
      dashboardInfo.layout = layout;
      dashboardInfo.widgets = widgets;

      if (dashboardId != null) {
        alert.success(`${dashboardTitle}\n대시보드를 수정하시겠습니까?`, {
          title: '대시보드 수정',
          closeCopy: '취소',
          actions: [
            {
              copy: '수정',
              onClick: () => {
                showLoading();
                DashboardService.updateDashboard(dashboardId, dashboardInfo)
                  .then(response => {
                    if (response.data.status === 'SUCCESS') {
                      navigate('/dashboard/' + dashboardId, { replace: true });
                      snackbar.success('대시보드가 수정되었습니다.');
                    } else {
                      alert.error('대시보드 수정에 실패했습니다.\n다시 시도해 주세요.');
                    }
                  })
                  .finally(() => {
                    hideLoading();
                  });
              },
            },
          ],
        });
      } else {
        alert.success(`${dashboardTitle}\n대시보드를 생성하시겠습니까?`, {
          title: '대시보드 생성',
          closeCopy: '취소',
          actions: [
            {
              copy: '생성',
              onClick: () => {
                showLoading();
                DashboardService.createDashboard(dashboardInfo)
                  .then(response => {
                    if (response.data.status === 'SUCCESS') {
                      navigate('/dashboard');
                      snackbar.success('대시보드가 생성되었습니다.');
                    } else {
                      alert.error('대시보드 생성에 실패했습니다.\n다시 시도해 주세요.');
                    }
                  })
                  .finally(() => {
                    hideLoading();
                  });
              },
            },
          ],
        });
      }
    }
  };

  // 취소 여부 버튼 이벤트
  const handleCancelDialogSelect = () => {
    navigate(-1);
  };

  const handleWidgetOpen = () => {
    setWidgetOpen(true);
  };

  const handleCompleteRecommend = dashboardInfo => {
    console.log(dashboardInfo);
    setWidgets(dashboardInfo.widgets);

    dashboardInfo.layout.map(item => {
      if (item.i !== undefined) {
        item.i = item.i.toString();
      }
    });
    setLayout(dashboardInfo.layout);
    setRecommendOpen(false);
  };

  return (
    <PageTitleBox
      upperTitle="대시보드"
      upperTitleLink="/dashboard"
      title={topTitle}
      sx={{ width: '100%', marginTop: { xs: 0, sm: '22px' }, flex: '1 1 auto', p: { xs: 0 } }}
      button={
        <Stack direction="row" spacing={3} sx={{ marginRight: '20px' }}>
          <ConfirmCancelButton
            confirmProps={{ disabled: false, onClick: handleSaveDialogSelect }}
            cancelProps={{ onClick: handleCancelDialogSelect }}
          />
        </Stack>
      }
    >
      <PageViewBox
        titleElement={
          <TextField
            id="userDashboardName"
            label="대시보드 이름"
            required
            sx={{
              width: { xs: '100%', sm: '960px' },
              height: '32px',
              marginLeft: { sm: '16px' },
              marginTop: 0,
              borderRadius: '4px',
              backgroundColor: '#fff',
              input: {
                fontWeight: 500,
                paddingLeft: '18px',
                height: '16px',
                fontFamily: 'Pretendard',
                fontSize: '14px',
                fontStretch: 'normal',
                fontStyle: 'normal',
                lineHeight: 0.89,
                letterSpacing: '-0.18px',
                textAlign: 'left',
                color: '#141414',
                '&::placeholder': {
                  height: '16px',
                  flexGrow: 0,
                  fontFamily: 'Pretendard',
                  fontSize: '14px',
                  fontWeight: 'normal',
                  fontStretch: 'normal',
                  fontStyle: 'normal',
                  lineHeight: '1.14',
                  letterSpacing: 'normal',
                  textAlign: 'left',
                  color: '#929292',
                  opacity: 1,
                },
              },
            }}
            placeholder="대시보드의 이름을 입력해 주세요"
            value={dashboardTitle}
            onChange={event => {
              setDashboardTitle(event.target.value);
            }}
          />
        }
        button={
          <>
            <Button
              onClick={handleWidgetOpen}
              variant="contained"
              startIcon={<AddIcon />}
              color="primary"
              sx={{
                borderRadius: '8px',
                backgroundColor: '#043f84',
                width: '97px',
                height: '32px',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '7px 0',
                objectFit: 'contain',
                border: 'solid 1px #0f5ab2',
              }}
            >
              위젯 추가
            </Button>
            <AddWidgetPopup
              label="위젯 추가"
              widgetSelect={handleWidgetSelect}
              useWidgetIds={useWidgetIds}
              widgetOpen={widgetOpen}
            />
          </>
        }
      >
        <Box
          sx={{
            width: '1390px',
            minWidth: '1390px',
            minHeight: '1080px',
            backgroundImage: `url(${bg})`,
            backgroundRepeat: 'repeat',
            borderRadius: '0px 0px 6px 6px',
          }}
        >
          <ResponsiveGridLayout
            rowHeight={88}
            compactType={null}
            cols={{ lg: 12 }}
            layouts={{ lg: layout }}
            preventCollision={true}
            containerPadding={{ lg: [24, 24] }}
            margin={{ lg: [24, 24] }}
            onLayoutChange={onLayoutChange}
          >
            {generateWidget()}
          </ResponsiveGridLayout>
          <RecommendDashboardPopup recommendOpen={recommendOpen} handleComplete={handleCompleteRecommend} />
        </Box>
      </PageViewBox>
    </PageTitleBox>
  );
}

export default DashboardModify;
