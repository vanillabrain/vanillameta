import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 지속성 테스트용 커스텀 메트릭
const memoryLeakIndicator = new Trend('memory_leak_indicator');
const performanceDegradation = new Trend('performance_degradation');
const resourceUtilization = new Trend('resource_utilization');
const longRunningErrors = new Rate('long_running_errors');
const timeBasedMetrics = new Counter('time_based_requests');

// 지속성 테스트 설정 - 1시간 동안 안정적인 부하 유지
export const options = {
  stages: [
    // 준비 단계
    { duration: '5m', target: 50 },     // 5분 동안 50명으로 증가
    
    // 지속 단계 (1시간)
    { duration: '60m', target: 50 },    // 60분 동안 50명 유지
    
    // 정리 단계
    { duration: '5m', target: 0 },      // 5분 동안 0명으로 감소
  ],
  
  thresholds: {
    // 지속성 테스트 임계값
    http_req_failed: ['rate<0.05'],                    // 에러율 5% 미만 유지
    http_req_duration: ['p(95)<2000'],                 // 95%가 2초 이내 유지
    memory_leak_indicator: ['p(95)<3000'],             // 메모리 누수 지표
    performance_degradation: ['p(95)<1.5'],            // 성능 저하 1.5배 이내
    long_running_errors: ['rate<0.02'],                // 장기 실행 에러 2% 미만
  },
  
  tags: {
    test_type: 'endurance',
    test_name: 'vanillameta_endurance_test',
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

// 기준 성능 저장
let baselineResponseTime = 0;
let requestCount = 0;

export function setup() {
  console.log('Starting endurance test setup...');
  
  // 기준선 측정
  const baselineRes = http.get(`${BASE_URL}/dashboard`);
  if (baselineRes.status === 200) {
    baselineResponseTime = baselineRes.timings.duration;
    console.log(`Baseline response time: ${baselineResponseTime}ms`);
  }
  
  return { baselineResponseTime };
}

export default function(data) {
  const testStartTime = Date.now();
  const iterationNumber = ++requestCount;
  
  group('Endurance Test - Core Operations', function() {
    // 인증
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      userId: `enduranceuser_${__VU}`,
      password: 'endurance123'
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'endurance', operation: 'login' },
      timeout: '30s'
    });
    
    const loginSuccess = check(loginRes, {
      'endurance login successful': (r) => r.status === 201,
    });
    
    longRunningErrors.add(!loginSuccess);
    
    if (loginSuccess) {
      const token = loginRes.json('accessToken');
      
      // 핵심 비즈니스 로직 시뮬레이션
      performCoreBusiness(token, iterationNumber, data.baselineResponseTime);
      
      // 메모리 사용량 시뮬레이션 (큰 데이터 처리)
      if (iterationNumber % 10 === 0) {
        performMemoryIntensiveOperation(token);
      }
      
      // 데이터베이스 연결 풀 테스트
      if (iterationNumber % 20 === 0) {
        performDatabasePoolTest(token);
      }
    }
  });
  
  // 시간에 따른 메트릭 기록
  timeBasedMetrics.add(1);
  
  // 다양한 대기 패턴 (실제 사용자 행동 시뮬레이션)
  const waitTime = generateRealisticWaitTime();
  sleep(waitTime);
}

// 핵심 비즈니스 로직 수행
function performCoreBusiness(token, iterationNumber, baselineTime) {
  const operationStart = Date.now();
  
  // 대시보드 조회 (가장 빈번한 작업)
  const dashboardRes = http.get(`${BASE_URL}/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { scenario: 'endurance', operation: 'dashboard-core' },
    timeout: '20s'
  });
  
  check(dashboardRes, {
    'core dashboard operation success': (r) => r.status === 200,
  });
  
  // 성능 저하 측정
  if (baselineTime > 0) {
    const currentResponseTime = dashboardRes.timings.duration;
    const degradationRatio = currentResponseTime / baselineTime;
    performanceDegradation.add(degradationRatio);
  }
  
  // 위젯 데이터 조회 (두 번째로 빈번한 작업)
  const widgetRes = http.get(`${BASE_URL}/widget`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { scenario: 'endurance', operation: 'widget-core' },
    timeout: '15s'
  });
  
  // 컴포넌트 조회 (캐시 테스트)
  const componentRes = http.get(`${BASE_URL}/component`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { scenario: 'endurance', operation: 'component-core' },
    timeout: '10s'
  });
  
  // 간헐적 데이터 생성 (5%의 요청에서만)
  if (Math.random() < 0.05) {
    const createRes = http.post(`${BASE_URL}/dashboard`, JSON.stringify({
      title: `Endurance Dashboard ${iterationNumber}`,
      description: `Long running test dashboard - ${new Date().toISOString()}`,
      layout: []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      tags: { scenario: 'endurance', operation: 'create-core' },
      timeout: '25s'
    });
    
    check(createRes, {
      'endurance create operation success': (r) => r.status === 201,
    });
  }
  
  const operationEnd = Date.now();
  const operationDuration = operationEnd - operationStart;
  
  // 메모리 누수 지표 (응답 시간이 지속적으로 증가하는지 확인)
  memoryLeakIndicator.add(operationDuration);
}

// 메모리 집약적 작업
function performMemoryIntensiveOperation(token) {
  // 큰 쿼리 실행 시뮬레이션
  const heavyQueryRes = http.post(`${BASE_URL}/database/execute-query`, JSON.stringify({
    id: 1,
    query: `
      SELECT 
        d1.*, d2.*, d3.*
      FROM 
        (SELECT * FROM test_table LIMIT 1000) d1
      CROSS JOIN 
        (SELECT * FROM test_table LIMIT 10) d2
      CROSS JOIN
        (SELECT * FROM test_table LIMIT 5) d3
    `,
    parameters: [],
    limit: 5000
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    tags: { scenario: 'endurance', operation: 'memory-intensive' },
    timeout: '60s'
  });
  
  check(heavyQueryRes, {
    'memory intensive operation handled': (r) => r.status === 200 || r.status === 400,
  });
  
  // 리소스 사용률 기록
  resourceUtilization.add(heavyQueryRes.timings.duration);
}

// 데이터베이스 연결 풀 테스트
function performDatabasePoolTest(token) {
  // 동시에 여러 DB 요청 실행
  const batchRequests = [];
  
  for (let i = 0; i < 5; i++) {
    batchRequests.push(
      http.asyncRequest('POST', `${BASE_URL}/database/execute-query`, JSON.stringify({
        id: 1,
        query: `SELECT ${i} as batch_id, NOW() as timestamp, random() as value`,
        parameters: [],
        limit: 100
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        tags: { scenario: 'endurance', operation: `pool-test-${i}` },
        timeout: '30s'
      })
    );
  }
  
  // 모든 요청 완료 대기
  const responses = http.batch(batchRequests);
  
  responses.forEach((res, index) => {
    check(res, {
      [`pool test ${index} success`]: (r) => r.status === 200 || r.status === 400,
    });
  });
}

// 실제 사용자 행동 패턴을 모방한 대기 시간 생성
function generateRealisticWaitTime() {
  const patterns = [
    () => Math.random() * 2 + 1,        // 40% - 빠른 클릭 (1-3초)
    () => Math.random() * 5 + 3,        // 30% - 보통 사용 (3-8초)
    () => Math.random() * 10 + 5,       // 20% - 신중한 사용 (5-15초)
    () => Math.random() * 30 + 10,      // 10% - 긴 대기 (10-40초)
  ];
  
  const patternIndex = Math.random();
  if (patternIndex < 0.4) return patterns[0]();
  if (patternIndex < 0.7) return patterns[1]();
  if (patternIndex < 0.9) return patterns[2]();
  return patterns[3]();
}

export function teardown(data) {
  console.log('Endurance test completed. Analyzing results...');
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const duration = data.state.testRunDurationMs / 1000 / 60; // minutes
  
  const analysis = {
    test_duration_minutes: duration,
    total_requests: metrics.http_reqs?.count || 0,
    error_rate: (metrics.http_req_failed?.rate || 0) * 100,
    avg_response_time: metrics.http_req_duration?.avg || 0,
    p95_response_time: metrics.http_req_duration?.['p(95)'] || 0,
    memory_leak_p95: metrics.memory_leak_indicator?.['p(95)'] || 0,
    performance_degradation_p95: metrics.performance_degradation?.['p(95)'] || 0,
    throughput: (metrics.http_reqs?.rate || 0).toFixed(2),
  };
  
  return {
    'stdout': `
=== ENDURANCE TEST SUMMARY ===

Test Duration: ${analysis.test_duration_minutes.toFixed(1)} minutes
Total Requests: ${analysis.total_requests}
Throughput: ${analysis.throughput} req/s

Performance Stability:
- Error Rate: ${analysis.error_rate.toFixed(2)}%
- Average Response Time: ${analysis.avg_response_time.toFixed(2)}ms
- P95 Response Time: ${analysis.p95_response_time.toFixed(2)}ms

Memory & Resource Analysis:
- Memory Leak Indicator P95: ${analysis.memory_leak_p95.toFixed(2)}ms
- Performance Degradation P95: ${analysis.performance_degradation_p95.toFixed(2)}x

Stability Assessment:
${analysis.error_rate < 5 ? '✅ PASS' : '❌ FAIL'} - Error rate within 5%
${analysis.p95_response_time < 2000 ? '✅ PASS' : '❌ FAIL'} - Response time stable
${analysis.performance_degradation_p95 < 1.5 ? '✅ PASS' : '❌ FAIL'} - No significant degradation
${analysis.memory_leak_p95 < 3000 ? '✅ PASS' : '❌ FAIL'} - No memory leaks detected

Recommendations:
${analysis.error_rate > 3 ? '- Investigate recurring errors during long runs\n' : ''}
${analysis.performance_degradation_p95 > 1.2 ? '- Monitor for gradual performance degradation\n' : ''}
${analysis.memory_leak_p95 > 2500 ? '- Check for memory leaks in long-running operations\n' : ''}

============================
    `,
    'endurance-test-results.json': JSON.stringify({
      summary: analysis,
      raw_metrics: data
    }),
  };
}