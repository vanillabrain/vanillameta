import { del, get, post, put } from '@/helpers/apiHelper';

export const URL_WIDGET = '/widget';

const selectWidgetList = (): Promise<any> => get(URL_WIDGET);
const selectWidget = (id: string, data): Promise<any> => get(URL_WIDGET + '/' + id, data);
const createWidget = (data: unknown): Promise<any> => post(URL_WIDGET, data);
const updateWidget = (data: unknown): Promise<any> => put(URL_WIDGET, data);
const deleteWidget = (data: unknown): Promise<any> => del(URL_WIDGET, data);

const WidgetService = {
  selectWidgetList,
  selectWidget,
  createWidget,
  updateWidget,
  deleteWidget,
};

export default WidgetService;
