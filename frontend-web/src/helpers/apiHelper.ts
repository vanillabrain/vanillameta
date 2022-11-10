import axios from 'axios';

// apply base url for axios
const API_URL = process.env.REACT_APP_API_URL;

const instance = axios.create({
  baseURL: API_URL,
  timeout: 100000,
  // withCredentials: true,
});

// Add a request interceptor
instance.interceptors.request.use(async config => {
  // something to do
  return config;
});

instance.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    // something to do
    return Promise.reject(error);
  },
);

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

export default instance;
