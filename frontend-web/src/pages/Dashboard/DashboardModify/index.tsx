import React, { useEffect, useState } from 'react';
import { Box, Button, Card, Stack, TextField } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import AddWidgetPopup from '@/pages/Dashboard/Components/AddWidgetPopup';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useAlert } from 'react-alert';

import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import AddIcon from '@mui/icons-material/Add';
import RecommendDashboardPopup from '@/pages/Dashboard/Components/RecommendDashboardPopup';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import DashboardTitleBox from '../Components/DashboardTitleBox';
import CloseButton from '@/components/button/CloseButton';
import bg from '@/assets/images/dashboard-bg.svg';

const ResponsiveGridLayout = WidthProvider(Responsive);

function DashboardModify() {
  const alert = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
    // todo 서비스 완료시 연결
    DashboardService.selectDashboard(id).then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        setDashboardTitle(response.data.data.title);
        setWidgets(response.data.data.widgets);

        response.data.data.layout.map((item, index) => {
          if (item.i !== undefined) {
            item.i = item.i.toString();
          }
        });
        setLayout(response.data.data.layout);
      } else {
        alert.error('조회를 실패하였습니다.');
      }
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

  // widget 생성
  const generateWidget = () => {
    useWidgetIds.length = 0;
    const addLayouts = [];
    widgets.map((item, index) => {
      if (layout.length <= index) {
        addLayouts.push({
          x: 0,
          y: 0,
          w: 5,
          h: 5,
          i: item.id.toString(),
        });
      }
    });

    if (addLayouts.length > 0) {
      setLayout([...layout, ...addLayouts]);
    }

    return widgets.map((item, index) => {
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
          <CloseButton
            sx={{
              position: 'absolute',
              right: '0px',
              top: '0px',
              paddingRight: '17px',
              paddingTop: '17px',
              cursor: 'pointer',
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
          <WidgetWrapper
            widgetOption={item}
            dataSetId={item.datasetId}
            sx={{ width: '100%', height: '100%', borderRadius: 1 }}
          />
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
      alert.info('제목을 입력 해주세요.', {
        onClose: () => {
          // todo 아래 기능 연결하기
          console.log('title 로 포커스 이동하기');
        },
      });
    } else if (layout.length == 0 || widgets.length == 0) {
      // 배치된 widget 이 없을경우
      alert.info('배치된 위젯이 없습니다.');
    } else {
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
                DashboardService.updateDashboard(dashboardId, dashboardInfo).then(() => {
                  navigate('/dashboard');
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
                DashboardService.createDashboard(dashboardInfo).then(() => {
                  navigate('/dashboard');
                });
              },
            },
          ],
        });
      }
    }
  };

  // 취소 여부 버튼 이벤트
  const handleCancelDialogSelect = detail => {
    if (detail == 1) {
      // 이전 페이지로 이동
      navigate(-1);
    }
  };

  const handleWidgetOpen = () => {
    setWidgetOpen(true);
  };

  const handleCompleteRecommend = dashboardInfo => {
    console.log(dashboardInfo);
    setWidgets(dashboardInfo.widgets);

    dashboardInfo.layout.map((item, index) => {
      if (item.i !== undefined) {
        item.i = item.i.toString();
      }
    });
    setLayout(dashboardInfo.layout);
    setRecommendOpen(false);
  };

  return (
    <PageContainer>
      <PageTitleBox
        title={topTitle}
        sx={{ width: '100%', marginTop: '22px' }}
        button={
          <Stack direction="row" spacing={3} sx={{ marginRight: '20px' }}>
            <ConfirmCancelButton
              confirmProps={{ disabled: false, onClick: handleSaveDialogSelect }}
              cancelProps={{ onClick: handleCancelDialogSelect }}
            />
          </Stack>
        }
      >
        <DashboardTitleBox
          title={
            <TextField
              id="userDashboardName"
              label=""
              required
              sx={{
                width: '960px',
                height: '32px',
                marginLeft: '16px',
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
                  marginRight: '20px',
                  padding: '7px 0',
                  objectFit: 'contain',
                  border: 'solid 1px #0f5ab2',
                }}
              >
                <span style={{ height: '20px' }}>위젯 추가</span>
              </Button>
              <AddWidgetPopup
                label="위젯 추가"
                widgetSelect={handleWidgetSelect}
                useWidgetIds={useWidgetIds}
                widgetOpen={widgetOpen}
              />
              <RecommendDashboardPopup recommendOpen={recommendOpen} handleComplete={handleCompleteRecommend} />
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
          </Box>
        </DashboardTitleBox>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DashboardModify;
