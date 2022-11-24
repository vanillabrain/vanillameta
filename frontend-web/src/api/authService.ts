import { del, get, patch, post } from '@/helpers/apiHelper';

export const URL_LOGIN = '/user/signin';
export const URL_SIGNUP = '/user/signup';
export const URL_SIGNOUT = '/user/signout';
export const URL_CHANGE_USERINFO = '/user/change-info';
export const URL_DELETE_ACCOUNT = '/user/delete-account';
export const URL_USER_INFO = '/user/userinfo';
export const URL_GET_ACCESS_TOKEN = '/user/get-access-token';

const login = (data: unknown): Promise<any> => post(URL_LOGIN, data);
const logout = (data: unknown): Promise<any> => post(URL_SIGNOUT, data);
const signup = (data: unknown): Promise<any> => post(URL_SIGNUP, data);
const updateUser = (data: unknown): Promise<any> => patch(URL_CHANGE_USERINFO, data);
const deleteUser = (data: unknown): Promise<any> => del(URL_DELETE_ACCOUNT, data);
const getUser = (): Promise<any> => get(URL_USER_INFO);
const getAccessToken = (): Promise<any> => post(URL_GET_ACCESS_TOKEN);

const authService = {
  login,
  logout,
  signup,
  updateUser,
  deleteUser,
  getUser,
  getAccessToken,
};

export default authService;