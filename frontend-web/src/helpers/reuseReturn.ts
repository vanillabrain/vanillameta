/** Only reviewed internal destinations can survive login. */
export function reuseReturn(search: string) {
  const params = new URLSearchParams(search),
    path = params.get('returnTo') ?? '';
  return params.getAll('returnTo').length === 1 && isLoginReturnPath(path) ? path : '/dashboard';
}

export function isLoginReturnPath(path: string): boolean {
  if (/[\r\n]/.test(path)) return false;
  return (
    /^\/reuse\/(share|publication)\/[a-f0-9-]{36}$/i.test(path) || /^\/ai-connections\/approve\/[a-f0-9]{64}$/.test(path)
  );
}
