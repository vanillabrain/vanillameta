import { get, post } from '@/helpers/apiHelper';

export const URL_SHARE = '/share-url';
export const URL_SHARE_ON = '/share-on';
export const URL_SHARE_OFF = '/share-off';
export const URL_SHARE_DASHBOARD = '/share-dashboard';

const onShareToken = (id: string, data: unknown): Promise<any> => post(URL_SHARE + URL_SHARE_ON + '/' + id, data);
const offShareToken = (id: string, data: unknown): Promise<any> => post(URL_SHARE + URL_SHARE_OFF + '/' + id, data);
const selectDashboard = (uuid: string): Promise<any> => get(URL_SHARE + URL_SHARE_DASHBOARD + '/' + uuid);

const shareService = {
  onShareToken,
  offShareToken,
  selectDashboard,
};

export default shareService;
