/**
 * widget series validation
 * @param seriesArr
 */
export const validateSeries = series => {
  return series.field.trim() !== '';
};
