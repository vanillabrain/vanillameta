import { del, get, post, put } from '@/helpers/apiHelper';

export const URL_WIDGET = '/widget';

const selectWidgetList = (): Promise<any> => get(URL_WIDGET);
const selectWidget = (id: string, data = null): Promise<any> => get(URL_WIDGET + '/' + id, data);
const createWidget = (data: unknown): Promise<any> => post(URL_WIDGET, data);
const updateWidget = (id: string, data: unknown): Promise<any> => put(URL_WIDGET + '/' + id, data);
const deleteWidget = (id: string): Promise<any> => del(URL_WIDGET + '/' + id);

const WidgetService = {
  selectWidgetList,
  selectWidget,
  createWidget,
  updateWidget,
  deleteWidget,
};

export default WidgetService;
