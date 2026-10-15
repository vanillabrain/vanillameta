import { useTranslation } from 'react-i18next';
import { useContext, useEffect, useState } from 'react';
import { useAlert } from 'react-alert';
import { LoadingContext } from '@/contexts/LoadingContext';
import shareService from '@/api/shareService';
import { setShareToken } from '@/helpers/shareHelper';

export interface ShareDashboardState {
  dashboardInfo: {
    title: string;
    widgets: any[];
    layout: any[];
    updatedAt: string;
    shareYn: string;
    uuid: string | null;
    shareToken: string | null;
  };
  layout: any[];
  isShareOn: boolean;
  isInvalidData: number | null;
  loading: boolean;
}

/**
 * 공유 대시보드 조회 hook — /share, /embed 페이지 공용
 */
export const useShareDashboard = (dashboardUuid: string): ShareDashboardState => {
  const { t } = useTranslation();
  const alert = useAlert();
  const { loading, showLoading, hideLoading } = useContext(LoadingContext);
  const [dashboardInfo, setDashboardInfo] = useState({
    title: '',
    widgets: [],
    layout: [],
    updatedAt: '',
    shareYn: 'N',
    uuid: null,
    shareToken: null,
  });
  const [layout, setLayout] = useState([]);
  const [isShareOn, setIsShareOn] = useState(false);
  const [isInvalidData, setIsInvalidData] = useState(null);

  useEffect(() => {
    showLoading();
    shareService
      .selectDashboard(dashboardUuid)
      .then(response => {
        if (response.status == 200) {
          if (response.data.data.shareToken) setShareToken(response.data.data.shareToken);
          setDashboardInfo(response.data.data);
        }
      })
      .catch(error => {
        const status = error?.response?.status ?? 500;
        const errorData = error?.response?.data?.data;
        const message = typeof errorData === 'string' ? errorData : errorData?.message;
        setIsInvalidData(status);
        if (status === 401 && message === 'expired date') {
          alert.error(t('share.expired'));
        } else if (status === 500) {
          alert.error(t('share.notFound'));
        } else {
          alert.error(t('share.fetchFailed'));
        }
      })
      .finally(() => {
        hideLoading();
      });
  }, []);

  useEffect(() => {
    dashboardInfo.layout.map(item => {
      if (item.i !== undefined) {
        item.i = item.i.toString();
      }
      item.static = true;
    });
    setLayout(dashboardInfo.layout);
    setIsShareOn(dashboardInfo.shareYn === 'Y');
    if (dashboardInfo.shareToken) {
      setShareToken(dashboardInfo.shareToken);
    }
  }, [dashboardInfo]);

  return { dashboardInfo, layout, isShareOn, isInvalidData, loading };
};
