import { HttpException, HttpStatus } from '@nestjs/common';

const READONLY_START = /^\s*(select|with|show|explain|describe|desc)\b/i;
const WRITE_KEYWORD =
  /\b(insert|update|delete|drop|alter|truncate|create|replace|merge|grant|revoke|call|exec|execute|vacuum|attach|detach|into|lock|unlock)\b/i;

/**
 * 사용자 쿼리가 읽기 전용인지 검증
 * - SELECT/WITH/SHOW/EXPLAIN/DESCRIBE로 시작해야 함
 * - 멀티 스테이트먼트(;) 차단
 * - 쓰기 키워드 포함 시 차단
 * QUERY_ALLOW_WRITE=true 설정 시 비활성화
 */
export function assertReadOnlyQuery(query: string) {
  if (process.env.QUERY_ALLOW_WRITE === 'true') return;
  const cleaned = String(query || '')
    .trim()
    .replace(/;+\s*$/, '');
  if (
    cleaned.length === 0 ||
    cleaned.includes(';') ||
    !READONLY_START.test(cleaned) ||
    WRITE_KEYWORD.test(cleaned)
  ) {
    throw new HttpException('only read-only queries are allowed', HttpStatus.BAD_REQUEST);
  }
}

/**
 * SQL 식별자(테이블/스키마명) 검증 - 인젝션 방지용 화이트리스트
 */
export function assertSafeIdentifier(name: string) {
  if (!/^[A-Za-z0-9_$.-]+$/.test(String(name || ''))) {
    throw new HttpException('invalid table name', HttpStatus.BAD_REQUEST);
  }
}
