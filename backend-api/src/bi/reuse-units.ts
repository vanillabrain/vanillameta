import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Database } from '../database/entities/database.entity';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { studioDemoData } from '../dashboard-studio/studio-demo-data';

/** Server-installed immutable fixtures only. Names and a currency CSV column are not contracts. */
export function trustedReuseCurrency(source: Database): string | undefined {
  if (!source || source.engine !== 'duckdb') return;
  let config: any;
  try {
    config = JSON.parse(decryptConnectionConfig(source.connectionConfig));
  } catch {
    return;
  }
  const version = config.fileVersions?.length === 1 ? config.fileVersions[0] : undefined;
  if (!version || config.connection?.filename !== version.filename) return;
  for (const id of ['margin', 'margin-reuse', 'margin-missing', 'margin-krw'] as const) {
    const digest = createHash('sha256').update(studioDemoData(id).csv).digest('hex');
    if (source.description === `studio-sample:vm-${id}-v1-${digest}` && version.sha256 === digest)
      return id === 'margin-krw' ? 'KRW' : 'USD';
  }
  const snapshot = config.commerceSnapshot;
  if (
    snapshot &&
    Number.isSafeInteger(snapshot.projectId) &&
    snapshot.projectId > 0 &&
    Number.isSafeInteger(snapshot.version) &&
    snapshot.version > 0 &&
    /^[a-f0-9]{64}$/.test(snapshot.digest) &&
    ['USD', 'KRW'].includes(snapshot.currency) &&
    snapshot.timeBasis === 'order-cohort' &&
    source.description ===
      `commerce-studio:order-cohort-v1:${snapshot.projectId}:${snapshot.version}:${snapshot.digest}`
  )
    return snapshot.currency;
}

export function assertReuseCurrency(
  original: string | undefined,
  target: string | undefined,
  confirmation?: unknown,
) {
  if (confirmation !== undefined && confirmation !== 'same-unit')
    throw new BadRequestException('파일 단위 확인 값을 확인해 주세요.');
  if (!original) return;
  if (target && original !== target)
    throw new BadRequestException(
      `금액 단위가 다릅니다: 원본 ${original}, 새 파일 ${target}. 환산하지 않았습니다. ${original} 파일을 선택하거나 새 분석에서 단위를 다시 정의해 주세요.`,
    );
  if (!target && confirmation !== 'same-unit')
    throw new BadRequestException(
      `새 파일의 금액 단위를 자동으로 확인할 수 없습니다. 원본과 같은 ${original} 단위임을 확인한 뒤 미리보기해 주세요. 통화 환산은 지원하지 않습니다.`,
    );
}
