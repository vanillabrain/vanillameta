import { validBusinessBasis } from '@/api/businessBasis';
const widgetTypes = ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'];
export const validDraft = (draft: any) =>
  draft &&
  (draft.businessBasis === undefined || validBusinessBasis(draft.businessBasis)) &&
  Number(draft.databaseId) > 0 &&
  typeof draft.title === 'string' &&
  draft.title.trim() &&
  Array.isArray(draft.widgets) &&
  draft.widgets.length > 0 &&
  draft.widgets.every(
    widget =>
      widget.blockId === undefined || (typeof widget.blockId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(widget.blockId)),
  ) &&
  new Set(draft.widgets.filter(widget => widget.blockId !== undefined).map(widget => widget.blockId)).size ===
    draft.widgets.filter(widget => widget.blockId !== undefined).length &&
  draft.widgets.every(
    widget =>
      widgetTypes.includes(widget.type) &&
      (widget.presentation === undefined ||
        widget.presentation === 'visual' ||
        (widget.presentation === 'summary' && widget.type === 'BOARD_NUMERIC') ||
        (widget.presentation === 'table' && widget.type !== 'BOARD_NUMERIC')) &&
      typeof widget.sql === 'string' &&
      widget.sql.trim() &&
      typeof widget.valueField === 'string' &&
      widget.valueField &&
      (widget.type === 'BOARD_NUMERIC' || (typeof widget.categoryField === 'string' && widget.categoryField)),
  );
export const validPreview = (preview: any) =>
  validDraft(preview?.draft) &&
  Array.isArray(preview.widgets) &&
  preview.widgets.length === preview.draft.widgets.length &&
  preview.widgets.every((widget, index) => {
    const definition = preview.draft.widgets[index];
    if (!Array.isArray(widget.datas) || !Array.isArray(widget.fields)) return false;
    const fields = widget.fields.map(field => (typeof field === 'string' ? field : field.name ?? field.columnName));
    return (
      widget.type === definition.type &&
      widget.sql === definition.sql &&
      widget.valueField === definition.valueField &&
      widget.categoryField === definition.categoryField &&
      fields.includes(definition.valueField) &&
      (definition.type === 'BOARD_NUMERIC' || fields.includes(definition.categoryField))
    );
  });
export const responseData = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error(response?.data?.message || 'Request failed.');
  return response.data.data;
};
export const errorMessage = (error: any) => {
  const payload = error?.response?.data;
  const message =
    payload?.message ||
    (typeof payload?.data === 'string' ? payload.data : undefined) ||
    // The server's {success:false, data:{error, message}} body for a refusal (quota, throttle, …).
    (typeof payload?.data?.message === 'string' ? payload.data.message : undefined);
  return (Array.isArray(message) ? message.join('\n') : message) || error?.message || 'Request failed.';
};
