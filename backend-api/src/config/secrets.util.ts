export const REQUIRED_SECRET_KEYS = ['ACCESS_SECRET', 'REFRESH_SECRET', 'URL_ACCESS_SECRET'];

/**
 * 환경변수 키 → SSM 파라미터 이름 매핑 생성.
 * 예: prefix '/vanillameta/prod' → { ACCESS_SECRET: '/vanillameta/prod/ACCESS_SECRET', ... }
 */
export function buildParameterNames(
  prefix: string,
  keys: readonly string[] = REQUIRED_SECRET_KEYS,
): Record<string, string> {
  const normalized = prefix.replace(/\/+$/, '');
  const mapping: Record<string, string> = {};
  keys.forEach(key => {
    mapping[key] = `${normalized}/${key}`;
  });
  return mapping;
}

/**
 * 파라미터 조회 함수로 비밀값을 읽어 환경변수 키→값 레코드로 반환.
 * 값이 없거나 빈 문자열이면 건너뛴다(기존 환경변수 유지).
 */
export async function resolveSecrets(
  fetchParameter: (name: string) => Promise<string | undefined>,
  parameterNames: Record<string, string>,
): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {};
  for (const [envKey, paramName] of Object.entries(parameterNames)) {
    const value = await fetchParameter(paramName);
    if (value !== undefined && value !== null && value !== '') {
      secrets[envKey] = value;
    }
  }
  return secrets;
}

/** 필수 시크릿이 비어 있는 키 목록 반환. */
export function findMissingSecrets(
  env: NodeJS.ProcessEnv,
  keys: readonly string[] = REQUIRED_SECRET_KEYS,
): string[] {
  return keys.filter(key => !env[key]);
}
