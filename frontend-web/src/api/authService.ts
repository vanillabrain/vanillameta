import { del, get, patch, post } from '@/helpers/apiHelper';

export const URL_LOGIN = '/user/signin';
export const URL_SIGNUP = '/user/signup';
export const URL_SIGNOUT = '/user/signout';
export const URL_CHANGE_USERNAME = '/user/change-username';
export const URL_CHANGE_PASSWORD = '/user/change-password';
export const URL_DELETE_ACCOUNT = '/user/delete-account';
export const URL_USER_INFO = '/user/userinfo';

const login = (data: unknown): Promise<any> => post(URL_LOGIN, data);
const logout = (data: unknown): Promise<any> => post(URL_SIGNOUT, data);
const join = (data: unknown): Promise<any> => post(URL_SIGNUP, data);
const updateUser = (data: unknown): Promise<any> => patch(URL_CHANGE_USERNAME, data);
const updatePassword = (data: unknown): Promise<any> => patch(URL_CHANGE_PASSWORD, data);
const deleteUser = (data: unknown): Promise<any> => del(URL_DELETE_ACCOUNT, data);
const selectUser = (id: string, data: unknown): Promise<any> => get(URL_USER_INFO + '/' + id, data);

const authService = {
  login,
  logout,
  join,
  updateUser,
  updatePassword,
  deleteUser,
  selectUser,
};

export default authService;
