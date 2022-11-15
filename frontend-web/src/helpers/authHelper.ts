export const STORAGE_ACCESS_TOKEN = 'accessToken';
export const STORAGE_REFRESH_TOKEN = 'refreshToken';

export const getToken = () => {
  const accessToken = JSON.parse(localStorage.getItem(STORAGE_ACCESS_TOKEN));
  if (accessToken) {
    return accessToken;
  }
  return null;
};
export const setToken = accessToken => {
  localStorage.setItem(STORAGE_ACCESS_TOKEN, JSON.stringify(accessToken));
};
export const removeToken = () => {
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
};

export const getRefreshToken = () => {
  const refreshToken = JSON.parse(localStorage.getItem(STORAGE_REFRESH_TOKEN));
  if (refreshToken) {
    return refreshToken;
  }
  return null;
};
export const setRefreshToken = refreshToken => {
  localStorage.setItem(STORAGE_REFRESH_TOKEN, JSON.stringify(refreshToken));
};
export const removeRefreshToken = () => {
  localStorage.removeItem(STORAGE_REFRESH_TOKEN);
};
