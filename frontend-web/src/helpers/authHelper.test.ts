import { getToken, removeToken, setToken } from './authHelper';

describe('authHelper', () => {
  beforeEach(() => localStorage.clear());

  it('토큰을 저장/조회/삭제한다', () => {
    expect(getToken()).toBeNull();

    setToken('token-123');
    expect(getToken()).toBe('token-123');

    removeToken();
    expect(getToken()).toBeNull();
  });
});
