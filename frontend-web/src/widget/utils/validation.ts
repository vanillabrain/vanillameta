/**
 * widget title validation
 * @param title
 */
export const validateTitle = _title => {
  const result = false;
  return;
};
/**
 * widget series validation
 * @param seriesArr
 */
export const validateSeries = series => {
  return series.field.trim() !== '';
};
