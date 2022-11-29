import { del, get, patch, post } from '@/helpers/apiHelper';

export const URL_SIGN_IN = '/login/signin';
export const URL_SIGN_UP = '/login/signup';
export const URL_SIGN_OUT = '/login/signout';
export const URL_USER_INFO = '/user/userinfo';
export const URL_CHANGE_USERINFO = '/user/change-info';
export const URL_DELETE_ACCOUNT = '/user/delete-account';
export const URL_ACCESS_TOKEN = '/user/get-access-token';
export const URL_SHARE_ON = '/share-url/share-on';
export const URL_SHARE_OFF = '/share-url/share-off';
export const URL_SHARE_DASHBOARD = '/share-url/share-dashboard';

const signin = (data: unknown): Promise<any> => post(URL_SIGN_IN, data);
const signout = (): Promise<any> => post(URL_SIGN_OUT);
const signup = (data: unknown): Promise<any> => post(URL_SIGN_UP, data);
const updateUser = (data: unknown): Promise<any> => patch(URL_CHANGE_USERINFO, data);
const deleteUser = (data: unknown): Promise<any> => del(URL_DELETE_ACCOUNT, data);
const getUserInfo = (): Promise<any> => get(URL_USER_INFO);
const refreshAccessToken = (): Promise<any> => post(URL_ACCESS_TOKEN);
const getShareTokenOn = (id: string): Promise<any> => post(URL_SHARE_ON + '/' + id);
const getShareTokenOff = (id: string): Promise<any> => post(URL_SHARE_OFF + '/' + id);
const getDashboardShareState = (id: string): Promise<any> => post(URL_SHARE_DASHBOARD + '/' + id);

const authService = {
  signin,
  signout,
  signup,
  updateUser,
  deleteUser,
  getUserInfo,
  refreshAccessToken,
  getShareTokenOn,
  getShareTokenOff,
  getDashboardShareState,
};

export default authService;
