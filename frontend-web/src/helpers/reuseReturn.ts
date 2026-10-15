/** Narrow internal return path; never navigate to an arbitrary returnTo URL. */
export function reuseReturn(search: string) {
  const params = new URLSearchParams(search),
    path = params.get('returnTo') ?? '';
  return params.getAll('returnTo').length === 1 && /^\/reuse\/(share|publication)\/[a-f0-9-]{36}$/i.test(path)
    ? path
    : '/dashboard';
}
