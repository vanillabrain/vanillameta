export const STORAGE_ACCESS_TOKEN = 'accessToken';

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
