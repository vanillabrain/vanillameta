import axios from 'axios';

// apply base url for axios
const API_URL = process.env.REACT_APP_API_URL;

const instance = axios.create({
  baseURL: API_URL,
  timeout: 100000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export async function get(url, data?, config = {}) {
  // return await instance.get(url, { params: { ...data } }, { ...config }).then((response) => response.data);
  return instance.get(url, { params: { ...data }, ...config });
}

export async function post(url, data?, config = {}) {
  return instance.post(url, { ...data }, { ...config });
}

export async function put(url, data?, config = {}) {
  return instance.put(url, { ...data }, { ...config });
}

export async function del(url, config = {}) {
  return instance.delete(url, { ...config });
}

export async function postForm(url, data?, config = {}) {
  return instance.post(url, data, { ...config });
}

export async function patch(url, data?, config = {}) {
  return instance.patch(url, { ...data }, { ...config });
}

export default instance;
