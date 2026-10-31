const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

function alternateLoopbackOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (!LOOPBACK_HOSTS.has(url.hostname)) return null;
    url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve browser origins for the API.
 *
 * Local development is commonly opened through either loopback spelling. Browsers treat
 * those as different origins, so accepting one while the page uses the other makes every
 * credentialed request fail before the API can explain the problem. Only non-production
 * configurations gain the matching loopback spelling; configured production origins are
 * returned unchanged.
 */
export function resolveCorsOrigins(
  configured: string | undefined,
  nodeEnv: string | undefined,
): string[] {
  const parsed = (configured ?? 'http://localhost:3000,http://localhost:3001,http://localhost:4000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  const origins = [...new Set(parsed)];
  const localDevelopment = !['prod', 'production'].includes((nodeEnv ?? '').toLowerCase());

  if (!localDevelopment) return origins;

  for (const origin of parsed) {
    const alternate = alternateLoopbackOrigin(origin);
    if (alternate && !origins.includes(alternate)) origins.push(alternate);
  }
  return origins;
}
