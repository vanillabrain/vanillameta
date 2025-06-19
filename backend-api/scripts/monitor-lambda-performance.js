#!/usr/bin/env node

/**
 * Lambda 성능 모니터링 스크립트
 * T01_S04: Lambda 메모리 최적화 성능 측정
 * 
 * 이 스크립트는 Lambda 함수의 성능 메트릭을 수집하고 분석합니다.
 * - 메모리 사용량
 * - 실행 시간
 * - 콜드 스타트 빈도
 * - 초기화 시간
 */

const AWS = require('aws-sdk');
const readline = require('readline');

// AWS 설정
const cloudwatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

const logs = new AWS.CloudWatchLogs({
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

// 커맨드라인 인터페이스 설정
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 환경 및 기간 설정
const ENVIRONMENTS = ['dev', 'prod'];
const TIME_PERIODS = {
  '1h': { minutes: 60, label: '지난 1시간' },
  '24h': { minutes: 1440, label: '지난 24시간' },
  '7d': { minutes: 10080, label: '지난 7일' },
  '30d': { minutes: 43200, label: '지난 30일' }
};

/**
 * CloudWatch 메트릭 가져오기
 */
async function getMetricStatistics(namespace, metricName, startTime, endTime, statistics = ['Average', 'Maximum', 'Minimum']) {
  const params = {
    Namespace: namespace,
    MetricName: metricName,
    StartTime: startTime,
    EndTime: endTime,
    Period: 300, // 5분 단위
    Statistics: statistics
  };

  try {
    const data = await cloudwatch.getMetricStatistics(params).promise();
    return data.Datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  } catch (error) {
    console.error(`메트릭 ${metricName} 조회 실패:`, error.message);
    return [];
  }
}

/**
 * Lambda 성능 메트릭 수집
 */
async function collectPerformanceMetrics(environment, period) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - period.minutes * 60000);
  
  console.log(`\n📊 ${environment.toUpperCase()} 환경 성능 메트릭 (${period.label})`);
  console.log('='.repeat(60));

  // Lambda 메트릭 수집
  const lambdaNamespace = 'AWS/Lambda';
  const functionName = `vanillameta-backend-api-${environment}-app`;
  
  // 1. 실행 시간 메트릭
  console.log('\n⏱️  실행 시간 분석');
  const duration = await getMetricStatistics(
    lambdaNamespace,
    'Duration',
    startTime,
    endTime,
    ['Average', 'Maximum', 'Minimum', 'Sum']
  );
  
  if (duration.length > 0) {
    const avgDuration = duration.reduce((acc, d) => acc + (d.Average || 0), 0) / duration.length;
    const maxDuration = Math.max(...duration.map(d => d.Maximum || 0));
    const minDuration = Math.min(...duration.filter(d => d.Minimum).map(d => d.Minimum));
    
    console.log(`  - 평균 실행 시간: ${avgDuration.toFixed(2)}ms`);
    console.log(`  - 최대 실행 시간: ${maxDuration.toFixed(2)}ms`);
    console.log(`  - 최소 실행 시간: ${minDuration.toFixed(2)}ms`);
  }

  // 2. 메모리 사용량 메트릭
  console.log('\n💾 메모리 사용량 분석');
  const customNamespace = `VanillaMeta/${environment}`;
  const memoryUsage = await getMetricStatistics(
    customNamespace,
    'MemoryUsage',
    startTime,
    endTime
  );
  
  if (memoryUsage.length > 0) {
    const avgMemory = memoryUsage.reduce((acc, m) => acc + (m.Average || 0), 0) / memoryUsage.length;
    const maxMemory = Math.max(...memoryUsage.map(m => m.Maximum || 0));
    const memoryPercent = (maxMemory / 1024) * 100;
    
    console.log(`  - 평균 메모리 사용: ${avgMemory.toFixed(2)}MB`);
    console.log(`  - 최대 메모리 사용: ${maxMemory.toFixed(2)}MB (${memoryPercent.toFixed(1)}%)`);
    console.log(`  - 메모리 여유도: ${(100 - memoryPercent).toFixed(1)}%`);
  }

  // 3. 콜드 스타트 분석
  console.log('\n❄️  콜드 스타트 분석');
  const coldStarts = await getMetricStatistics(
    customNamespace,
    'ColdStartCount',
    startTime,
    endTime,
    ['Sum']
  );
  
  const totalColdStarts = coldStarts.reduce((acc, cs) => acc + (cs.Sum || 0), 0);
  console.log(`  - 총 콜드 스타트 횟수: ${totalColdStarts}회`);
  
  // 초기화 시간
  const initDuration = await getMetricStatistics(
    customNamespace,
    'InitDuration',
    startTime,
    endTime
  );
  
  if (initDuration.length > 0) {
    const avgInit = initDuration.reduce((acc, i) => acc + (i.Average || 0), 0) / initDuration.length;
    const maxInit = Math.max(...initDuration.map(i => i.Maximum || 0));
    
    console.log(`  - 평균 초기화 시간: ${avgInit.toFixed(2)}ms`);
    console.log(`  - 최대 초기화 시간: ${maxInit.toFixed(2)}ms`);
  }

  // 4. 에러 및 응답 상태
  console.log('\n🚨 에러 및 응답 상태');
  const errors = await getMetricStatistics(
    customNamespace,
    'ErrorCount',
    startTime,
    endTime,
    ['Sum']
  );
  
  const totalErrors = errors.reduce((acc, e) => acc + (e.Sum || 0), 0);
  console.log(`  - 총 에러 발생 횟수: ${totalErrors}회`);

  // 5. 성능 개선 효과 분석 (512MB 대비)
  console.log('\n📈 성능 개선 효과 (512MB → 1024MB)');
  if (avgDuration) {
    const estimatedOldDuration = avgDuration * 1.5; // 예상 이전 실행 시간
    const improvement = ((estimatedOldDuration - avgDuration) / estimatedOldDuration) * 100;
    console.log(`  - 예상 성능 개선율: ${improvement.toFixed(1)}%`);
    console.log(`  - 예상 시간 절약: ${(estimatedOldDuration - avgDuration).toFixed(2)}ms/요청`);
  }

  // 6. 비용 분석
  console.log('\n💰 비용 영향 분석');
  const invocations = await getMetricStatistics(
    lambdaNamespace,
    'Invocations',
    startTime,
    endTime,
    ['Sum']
  );
  
  const totalInvocations = invocations.reduce((acc, i) => acc + (i.Sum || 0), 0);
  if (totalInvocations > 0 && avgDuration) {
    const gbSeconds = (1024 / 1024) * (avgDuration / 1000) * totalInvocations;
    const estimatedCost = gbSeconds * 0.0000166667;
    
    console.log(`  - 총 호출 횟수: ${totalInvocations.toLocaleString()}회`);
    console.log(`  - GB-초 사용량: ${gbSeconds.toFixed(2)}`);
    console.log(`  - 예상 비용: $${estimatedCost.toFixed(4)}`);
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * 대화형 인터페이스
 */
async function interactiveMode() {
  console.log('\n🚀 Lambda 성능 모니터링 도구');
  console.log('메모리 최적화 (512MB → 1024MB) 성능 분석\n');

  const askEnvironment = () => {
    return new Promise((resolve) => {
      console.log('환경을 선택하세요:');
      ENVIRONMENTS.forEach((env, index) => {
        console.log(`${index + 1}. ${env}`);
      });
      console.log('0. 모든 환경');

      rl.question('선택 (0-2): ', (answer) => {
        const choice = parseInt(answer);
        if (choice === 0) {
          resolve(ENVIRONMENTS);
        } else if (choice > 0 && choice <= ENVIRONMENTS.length) {
          resolve([ENVIRONMENTS[choice - 1]]);
        } else {
          console.log('잘못된 선택입니다.');
          resolve(askEnvironment());
        }
      });
    });
  };

  const askPeriod = () => {
    return new Promise((resolve) => {
      console.log('\n기간을 선택하세요:');
      const periods = Object.entries(TIME_PERIODS);
      periods.forEach(([key, value], index) => {
        console.log(`${index + 1}. ${value.label}`);
      });

      rl.question('선택 (1-4): ', (answer) => {
        const choice = parseInt(answer);
        if (choice > 0 && choice <= periods.length) {
          resolve(periods[choice - 1][1]);
        } else {
          console.log('잘못된 선택입니다.');
          resolve(askPeriod());
        }
      });
    });
  };

  try {
    const environments = await askEnvironment();
    const period = await askPeriod();

    console.log('\n📊 메트릭 수집 중...');
    
    for (const env of environments) {
      await collectPerformanceMetrics(env, period);
    }

    console.log('\n✅ 성능 분석 완료!');
    console.log('\n💡 권장사항:');
    console.log('  - 메모리 사용률이 80% 이상이면 추가 메모리 할당 고려');
    console.log('  - 콜드 스타트가 빈번하면 워밍 전략 강화');
    console.log('  - 에러가 발생하면 로그를 확인하여 원인 분석');

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    rl.close();
  }
}

// 스크립트 실행
if (require.main === module) {
  interactiveMode();
}

module.exports = {
  collectPerformanceMetrics,
  getMetricStatistics
};