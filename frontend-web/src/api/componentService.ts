import { del, get, post, put } from '@/helpers/apiHelper';

export const URL_COMPONENT = '/component';

const selectComponentList = (): Promise<any> => get(URL_COMPONENT);
const selectComponent = (id: string, data): Promise<any> => get(URL_COMPONENT + '/' + id, data);
const createComponent = (data: unknown): Promise<any> => post(URL_COMPONENT, data);
const updateComponent = (data: unknown): Promise<any> => put(URL_COMPONENT, data);
const deleteComponent = (data: unknown): Promise<any> => del(URL_COMPONENT, data);

const componentService = {
  selectComponentList,
  selectComponent,
  createComponent,
  updateComponent,
  deleteComponent,
};

export default componentService;
