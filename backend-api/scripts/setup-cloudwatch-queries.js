#!/usr/bin/env node

/**
 * CloudWatch Insights 저장된 쿼리 설정 스크립트
 * 
 * 사용법:
 * node scripts/setup-cloudwatch-queries.js --environment=prod
 */

const { CloudWatchLogsClient, PutQueryDefinitionCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { program } = require('commander');

// 명령행 인자 파싱
program
  .option('-e, --environment <env>', 'Environment (dev, prod, local)', 'dev')
  .option('-r, --region <region>', 'AWS Region', 'ap-northeast-2')
  .parse();

const options = program.opts();
const environment = options.environment;
const region = options.region;

// AWS 설정
const cloudwatchLogs = new CloudWatchLogsClient({ region });

// 로그 그룹 이름
const logGroupName = `/aws/lambda/vanillameta-backend-api-${environment}-app`;

// 저장할 쿼리 템플릿
const queries = [
  {
    name: `${environment}-recent-errors`,
    description: '최근 에러 로그 조회',
    query: `fields @timestamp, level, message, metadata.correlationId, metadata.context
| filter level = "ERROR"
| sort @timestamp desc
| limit 100`
  },
  {
    name: `${environment}-http-requests`,
    description: 'HTTP 요청 분석',
    query: `fields @timestamp, message, metadata.method, metadata.requestPath, metadata.statusCode, metadata.executionTime, metadata.correlationId
| filter metadata.method exists
| sort @timestamp desc
| limit 50`
  },
  {
    name: `${environment}-slow-requests`,
    description: '응답 시간 분석 (느린 요청)',
    query: `fields @timestamp, metadata.method, metadata.requestPath, metadata.executionTime, metadata.correlationId
| filter metadata.executionTime > 1000
| sort metadata.executionTime desc
| limit 20`
  },
  {
    name: `${environment}-api-performance`,
    description: 'API 엔드포인트별 평균 응답 시간',
    query: `fields metadata.requestPath, metadata.executionTime
| filter metadata.executionTime exists
| stats avg(metadata.executionTime) as avgTime, count() as requestCount by metadata.requestPath
| sort avgTime desc`
  },
  {
    name: `${environment}-status-codes`,
    description: 'HTTP 상태 코드별 집계',
    query: `fields metadata.statusCode
| filter metadata.statusCode exists
| stats count() as count by metadata.statusCode
| sort count desc`
  },
  {
    name: `${environment}-error-analysis`,
    description: '에러 유형별 분석',
    query: `fields @timestamp, level, message, metadata.context, metadata.correlationId
| filter level in ["ERROR", "WARN"]
| stats count() as errorCount by level, metadata.context
| sort errorCount desc`
  },
  {
    name: `${environment}-user-activity`,
    description: '사용자별 활동 분석',
    query: `fields @timestamp, metadata.userId, metadata.method, metadata.requestPath
| filter metadata.userId exists
| stats count() as activityCount by metadata.userId
| sort activityCount desc
| limit 20`
  },
  {
    name: `${environment}-auth-logs`,
    description: '인증 관련 로그',
    query: `fields @timestamp, level, message, metadata.userId, metadata.correlationId
| filter message like /login|auth|token|jwt/
| sort @timestamp desc
| limit 100`
  },
  {
    name: `${environment}-database-errors`,
    description: '데이터베이스 관련 에러',
    query: `fields @timestamp, level, message, metadata.correlationId
| filter message like /database|connection|query|mysql/
| filter level = "ERROR"
| sort @timestamp desc
| limit 50`
  },
  {
    name: `${environment}-security-analysis`,
    description: '실패한 로그인 시도',
    query: `fields @timestamp, level, message, metadata.ip, metadata.userAgent
| filter message like /login/ and level = "ERROR"
| sort @timestamp desc
| limit 50`
  }
];

/**
 * CloudWatch Insights 쿼리 생성
 */
async function createQuery(query) {
  const command = new PutQueryDefinitionCommand({
    name: query.name,
    queryString: `SOURCE '${logGroupName}'\n| ${query.query}`,
    logGroupNames: [logGroupName]
  });

  try {
    const result = await cloudwatchLogs.send(command);
    console.log(`✅ 쿼리 생성됨: ${query.name} (ID: ${result.queryDefinitionId})`);
    return result;
  } catch (error) {
    console.error(`❌ 쿼리 생성 실패: ${query.name}`, error.message);
    throw error;
  }
}

/**
 * 로그 그룹 존재 확인
 */
async function checkLogGroup() {
  try {
    await cloudwatchLogs.describeLogGroups({
      logGroupNamePrefix: logGroupName,
      limit: 1
    }).promise();
    console.log(`✅ 로그 그룹 확인됨: ${logGroupName}`);
    return true;
  } catch (error) {
    console.error(`❌ 로그 그룹을 찾을 수 없음: ${logGroupName}`);
    console.error('Serverless 배포를 먼저 실행하세요.');
    return false;
  }
}

/**
 * 기존 쿼리 조회
 */
async function listExistingQueries() {
  try {
    const result = await cloudwatchLogs.describeQueryDefinitions({
      queryDefinitionNamePrefix: `${environment}-`
    }).promise();
    
    if (result.queryDefinitions && result.queryDefinitions.length > 0) {
      console.log(`\n📋 기존 쿼리 (${result.queryDefinitions.length}개):`);
      result.queryDefinitions.forEach(query => {
        console.log(`  - ${query.name} (ID: ${query.queryDefinitionId})`);
      });
      console.log('');
    }
    
    return result.queryDefinitions || [];
  } catch (error) {
    console.error('기존 쿼리 조회 실패:', error.message);
    return [];
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log(`🚀 CloudWatch Insights 쿼리 설정 시작`);
  console.log(`환경: ${environment}`);
  console.log(`리전: ${region}`);
  console.log(`로그 그룹: ${logGroupName}\n`);

  // 로그 그룹 존재 확인
  const logGroupExists = await checkLogGroup();
  if (!logGroupExists) {
    process.exit(1);
  }

  // 기존 쿼리 조회
  await listExistingQueries();

  // 각 쿼리 생성
  console.log(`📝 ${queries.length}개 쿼리 생성 중...\n`);
  
  const results = [];
  for (const query of queries) {
    try {
      const result = await createQuery(query);
      results.push({ success: true, query: query.name, result });
    } catch (error) {
      results.push({ success: false, query: query.name, error: error.message });
    }
  }

  // 결과 요약
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n📊 결과 요약:`);
  console.log(`✅ 성공: ${successful}개`);
  console.log(`❌ 실패: ${failed}개`);

  if (failed > 0) {
    console.log(`\n❌ 실패한 쿼리:`);
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.query}: ${r.error}`));
  }

  console.log(`\n🎉 CloudWatch Insights 쿼리 설정 완료!`);
  console.log(`\n📍 CloudWatch Console에서 확인:`);
  console.log(`https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:logs-insights`);
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 중 오류 발생:', error);
    process.exit(1);
  });
}

module.exports = {
  createQuery,
  checkLogGroup,
  listExistingQueries,
  queries
};