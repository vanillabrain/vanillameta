import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { MenuButton } from '@/components/button/AddIconButton';
import { Plus } from 'lucide-react';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';

const title = '대시보드';

function Dashboard() {
  const { dashboardId } = useParams();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const [loadedDashboardData, setLoadedDashboardData] = useState([]);
  const [noData, setNoData] = useState(false);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const matches = typeof window !== 'undefined' ? window.innerWidth >= 640 : true;


  const menuList = [
    { name: '대시보드', link: '/dashboard/create', id: 'dashboard' },
    { name: '대시보드 추천', link: '', id: 'recommend' },
  ];

  useEffect(() => {
    getDashboardList();
  }, []);

  // dashboard info 조회
  const getDashboardList = useCallback(() => {
    showLoading();
    DashboardService.selectDashboardList()
      .then(response => {
        console.log('대시보드 응답 전체:', response);
        console.log('대시보드 응답 데이터:', response.data);
        console.log('STATUS.SUCCESS:', STATUS.SUCCESS);
        console.log('response.status:', response.status);
        console.log('비교 결과:', response.status == STATUS.SUCCESS);

        // API 헬퍼가 response.data를 반환하므로, response 자체가 백엔드의 응답 데이터
        if (response.status == STATUS.SUCCESS) {
          setLoadedDashboardData(response.data);
          setNoData(response.data.length == 0);
        } else {
          console.log('상태 체크 실패로 인한 오류');
          alert.error('대시보드 조회에 실패했습니다.\n다시 시도해 주세요.');
        }
      })
      .catch(error => {
        console.log('대시보드 조회 오류:', error);
        alert.error('대시보드 조회에 실패했습니다.\n다시 시도해 주세요.');
      })
      .finally(() => {
        hideLoading();
      });
  }, [showLoading, hideLoading, alert]);

  const handleDeleteSelect = useCallback(
    (id, title) => {
      alert.success(
        <div>
          <span className="font-semibold">{title}</span>
          <br />
          대시보드를 삭제하시겠습니까?
        </div>,
        {
          closeCopy: '취소',
          actions: [
            {
              copy: '확인',
              onClick: () => {
                showLoading();
                DashboardService.deleteDashboard(id)
                  .then(response => {
                    if (response.status == STATUS.SUCCESS) {
                      getDashboardList();
                      snackbar.success('대시보드가 삭제되었습니다.');
                    } else {
                      alert.error('대시보드 삭제에 실패했습니다.\n다시 시도해 주세요.');
                    }
                  })
                  .finally(() => {
                    hideLoading();
                  });
              },
            },
          ],
        },
      );
    },
    [alert, showLoading, hideLoading, snackbar, getDashboardList],
  );

  const handleMenuSelect = useCallback(
    item => {
      console.log(item);
      if (item.id !== undefined) {
        if (item.id == 'dashboard') {
          navigate('/dashboard/create?createType=dashboard');
        } else {
          navigate('/dashboard/create?createType=recommend');
        }
      }
    },
    [navigate],
  );

  // 목록이 없을때 보여줄 화면
  const getEmptyView = useMemo(() => {
    return (
      <>
        <div
          className="flex flex-row justify-between pl-5 pr-11 sm:pr-[217px] mb-[11px] mt-9"
        >
          <span className="text-[10px] sm:text-[13px] font-medium leading-[1.23] text-[#767676]">이름</span>
          <span className="text-[10px] sm:text-[13px] font-medium leading-[1.23] text-[#767676]">수정일</span>
        </div>
        <div
          className="flex justify-center items-center py-[18px] rounded-md border border-[#ddd] bg-white"
        >
          <span
            className="font-semibold text-center text-[#333333] text-sm sm:text-base leading-[1.43]"
          >
            생성한 대시보드가 없습니다.
            {matches ? ' ' : <br />}
            대시보드를 생성 후 확인해 보세요.
          </span>
        </div>
      </>
    );
  }, [matches]);

  return (
    <div className="w-full h-full flex-auto flex flex-col">
      <Seo title={title} />

      {!dashboardId ? (
        <>
          <PageTitleBox
            title={title}
            button={
              <MenuButton
                menuList={menuList}
                handleSelect={handleMenuSelect}
                icon={<Plus className="w-4 h-4" />}
                title="대시보드 추가"
                sizeOption={{ width: 108, height: 32 }}
              />
            }
          >
            {noData ? (
              getEmptyView
            ) : (
              <>
                <BoardList postList={loadedDashboardData} handleDeleteSelect={handleDeleteSelect} />
              </>
            )}
          </PageTitleBox>
        </>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

export default React.memo(Dashboard);
