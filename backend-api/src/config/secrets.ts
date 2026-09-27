import { Logger } from '@nestjs/common';
import { buildParameterNames, findMissingSecrets, resolveSecrets } from './secrets.util';

const logger = new Logger('Secrets');

/**
 * `SECRETS_FROM_SSM=true` 이면 AWS SSM Parameter Store 에서 시크릿을 읽어 process.env 에 주입한다.
 * 그렇지 않으면(.env 사용) 부족한 필수 시크릿을 경고만 남긴다.
 * AWS SDK 는 동적으로 require 하여 미사용 시 번들/의존성 부담을 없앤다.
 */
export async function maybeLoadSecretsFromSsm(): Promise<void> {
  if (process.env.SECRETS_FROM_SSM !== 'true') {
    const missing = findMissingSecrets(process.env);
    if (missing.length > 0 && process.env.NODE_ENV === 'prod') {
      logger.warn(`missing required secrets: ${missing.join(', ')}`);
    }
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
  const prefix =
    process.env.SSM_PARAM_PREFIX || `/vanillameta/${process.env.NODE_ENV || 'prod'}`;
  const client = new SSMClient({ region: process.env.AWS_REGION });

  const secrets = await resolveSecrets(async name => {
    const res = await client.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    return res.Parameter?.Value;
  }, buildParameterNames(prefix));

  Object.assign(process.env, secrets);
  logger.log(`loaded ${Object.keys(secrets).length} secret(s) from SSM prefix ${prefix}`);
}
