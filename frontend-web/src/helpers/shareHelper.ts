export const STORAGE_SHARE_TOKEN = 'shareToken';

export const getShareToken = () => {
  const shareToken = JSON.parse(localStorage.getItem(STORAGE_SHARE_TOKEN));
  if (shareToken) {
    return shareToken;
  }
  return null;
};
export const setShareToken = shareToken => {
  localStorage.setItem(STORAGE_SHARE_TOKEN, JSON.stringify(shareToken));
};
