/** Only build/public static directories are cacheable; API, uploads and private images are not. */
export const publicStaticResource = (url: URL, origin: string) =>
  url.origin === origin && /^\/(?:assets|static|fonts|img|images)\//.test(url.pathname);
export const shellNavigation = (url: URL, origin: string) =>
  url.origin === origin &&
  !/^\/(?:v1|api|uploads)(?:\/|$)/.test(url.pathname) &&
  !url.pathname.startsWith('/_') &&
  !/\/[^/?]+\.[^/]+$/.test(url.pathname);
