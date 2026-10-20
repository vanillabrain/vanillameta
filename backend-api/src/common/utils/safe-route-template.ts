export const UNMATCHED_ROUTE = '[unmatched]';

/** Route labels must come from framework registration, never request URLs or router mount values. */
export function safeRouteTemplate(request?: { route?: { path?: unknown } } | null): string {
  const template = request?.route?.path;
  if (typeof template !== 'string' || !template.startsWith('/') || /[\r\n\u0000]/.test(template)) {
    return UNMATCHED_ROUTE;
  }
  // A query must never become a log/metric dimension, even on malformed registration metadata.
  return template.split(/[?#]/, 1)[0] || UNMATCHED_ROUTE;
}
