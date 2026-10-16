import { clearEditorDrafts } from './editorDraftStorage';
export const STORAGE_ACCESS_TOKEN = 'accessToken';

export const getToken = () => {
  const stored = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (stored === null) return null;
  try {
    const accessToken: unknown = JSON.parse(stored);
    if (typeof accessToken === 'string' && accessToken.trim()) return accessToken;
  } catch {
    localStorage.removeItem(STORAGE_ACCESS_TOKEN);
    return null;
  }
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
  return null;
};
export const setToken = (accessToken, preserveDrafts = false) => {
  if (!preserveDrafts) clearEditorDrafts();
  localStorage.setItem(STORAGE_ACCESS_TOKEN, JSON.stringify(accessToken));
};
export const removeToken = () => {
  clearEditorDrafts();
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
};
