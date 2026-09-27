import { del, get, patch, post } from '@/helpers/apiHelper';
import authService from './authService';

jest.mock('@/helpers/apiHelper');

describe('authService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('signin 은 POST /login/signin 으로 요청한다', () => {
    const data = { userId: 'a', password: 'b' };
    authService.signin(data);

    expect(post).toHaveBeenCalledWith('/login/signin', data);
  });

  it('getUserInfo 는 GET /user/userinfo 로 요청한다', () => {
    authService.getUserInfo();

    expect(get).toHaveBeenCalledWith('/user/userinfo');
  });

  it('updateUser 는 PATCH /user/change-info 로 요청한다', () => {
    const data = { email: 'x@example.com' };
    authService.updateUser(data);

    expect(patch).toHaveBeenCalledWith('/user/change-info', data);
  });

  it('deleteUser 는 DELETE /user/delete-account 로 요청한다', () => {
    const data = { password: 'x' };
    authService.deleteUser(data);

    expect(del).toHaveBeenCalledWith('/user/delete-account', data);
  });
});
