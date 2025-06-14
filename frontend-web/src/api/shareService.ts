import { get, post } from '@/helpers/apiHelper';
import { ApiResponse, ShareTokenRequest, ShareDashboardResponse, ShareTokenResponse } from '@/types';

export const URL_SHARE = '/share-url';
export const URL_SHARE_ON = '/share-on';
export const URL_SHARE_OFF = '/share-off';
export const URL_SHARE_DASHBOARD = '/share-dashboard';

const onShareToken = (id: string, data: ShareTokenRequest): Promise<ApiResponse<ShareTokenResponse>> =>
  post(URL_SHARE + URL_SHARE_ON + '/' + id, data);

const offShareToken = (id: string, data: ShareTokenRequest): Promise<ApiResponse<null>> =>
  post(URL_SHARE + URL_SHARE_OFF + '/' + id, data);

const selectDashboard = (uuid: string): Promise<ApiResponse<ShareDashboardResponse>> =>
  get(URL_SHARE + URL_SHARE_DASHBOARD + '/' + uuid);

const shareService = {
  onShareToken,
  offShareToken,
  selectDashboard,
};

export default shareService;
