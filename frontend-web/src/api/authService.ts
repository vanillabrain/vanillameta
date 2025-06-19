import { del, get, patch, post } from '@/helpers/apiHelper';
import { AxiosResponse } from 'axios';

// 백엔드 응답 타입에 맞춤 (userId 사용)
export interface SignInRequest {
  userId: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface UpdateUserRequest {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export const URL_LOGIN = '/login';
export const URL_SIGN_IN = '/signin';
export const URL_SIGN_UP = '/signup';
export const URL_SIGN_OUT = '/signout';

export const URL_USER = '/user';
export const URL_USER_INFO = '/userinfo';
export const URL_CHANGE_USERINFO = '/change-info';
export const URL_DELETE_ACCOUNT = '/delete-account';
export const URL_ACCESS_TOKEN = '/get-access-token';

const signin = (data: SignInRequest): Promise<AxiosResponse<any>> => post(URL_LOGIN + URL_SIGN_IN, data);

const signout = (): Promise<AxiosResponse<any>> => post(URL_LOGIN + URL_SIGN_OUT);

const signup = (data: SignUpRequest): Promise<AxiosResponse<any>> => post(URL_LOGIN + URL_SIGN_UP, data);

const updateUser = (data: UpdateUserRequest): Promise<AxiosResponse<any>> => patch(URL_USER + URL_CHANGE_USERINFO, data);

const deleteUser = (data: { password: string }): Promise<AxiosResponse<any>> => del(URL_USER + URL_DELETE_ACCOUNT, data);

const getUserInfo = (): Promise<AxiosResponse<any>> => get(URL_USER + URL_USER_INFO);

const refreshAccessToken = (): Promise<AxiosResponse<any>> => post(URL_USER + URL_ACCESS_TOKEN);

const authService = {
  signin,
  signout,
  signup,
  updateUser,
  deleteUser,
  getUserInfo,
  refreshAccessToken,
};

export default authService;
