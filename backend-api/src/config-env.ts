/** Local machine settings override the shared development file; shell values win. */
export function apiEnvFiles(environment = process.env.NODE_ENV): string[] {
  if (environment === 'prod') return ['.env'];
  if (environment === 'local') return ['.env.local', '.env.dev'];
  return ['.env.dev'];
}
