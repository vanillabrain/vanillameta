import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// 커스텀 메트릭
const errorRate = new Rate('error_rate');
const successRate = new Rate('success_rate');
const responseTime = new Trend('custom_response_time');
const concurrentUsers = new Gauge('concurrent_users');
const totalRequests = new Counter('total_requests');
const failedRequests = new Counter('failed_requests');

// 스트레스 테스트 설정 - 시스템의 한계점 찾기
export const options = {
  stages: [
    // 급격한 증가
    { duration: '30s', target: 100 },    // 30초 동안 100명
    { duration: '1m', target: 200 },     // 1분 동안 200명
    { duration: '2m', target: 500 },     // 2분 동안 500명
    { duration: '3m', target: 1000 },    // 3분 동안 1000명
    { duration: '2m', target: 1500 },    // 2분 동안 1500명 (극한 부하)
    { duration: '1m', target: 2000 },    // 1분 동안 2000명 (시스템 한계 테스트)
    { duration: '2m', target: 0 },       // 2분 동안 0명으로 감소 (회복 테스트)
  ],
  
  thresholds: {
    // 스트레스 테스트는 실패를 예상하므로 임계값을 느슨하게 설정
    http_req_failed: ['rate<0.3'],           // 에러율 30% 미만 (일반적인 5%보다 높음)
    http_req_duration: ['p(95)<10000'],      // 95%가 10초 이내 (일반적인 2초보다 높음)
    error_rate: ['rate<0.3'],                // 커스텀 에러율 30% 미만
  },
  
  // 추가 설정
  noConnectionReuse: true,                   // 연결 재사용 안함 (더 현실적인 부하)
  discardResponseBodies: true,               // 응답 본문 무시 (메모리 절약)
  
  // 태그
  tags: {
    test_type: 'stress',
    test_name: 'vanillameta_stress_test',
  },
  
  // 확장 옵션
  ext: {
    loadimpact: {
      projectID: 123456,
      name: "VanillaMeta Stress Test",
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:eu:dublin': { loadZone: 'amazon:eu:dublin', percent: 50 },
      },
    },
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';
const STRESS_TEST_USER = {
  userId: 'stresstest',
  password: 'stress123!@#'
};

// 스트레스 테스트 시나리오
export default function() {
  const vu = __VU;  // Virtual User ID
  const iter = __ITER;  // Iteration number
  
  concurrentUsers.add(__VU);
  
  // 부하 분산을 위한 랜덤 시나리오 선택
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    // 30% - 무거운 작업 (대시보드 + 위젯 생성)
    heavyOperations(vu, iter);
  } else if (scenario < 0.6) {
    // 30% - 중간 작업 (데이터 쿼리)
    mediumOperations(vu, iter);
  } else {
    // 40% - 가벼운 작업 (조회만)
    lightOperations(vu, iter);
  }
  
  // 랜덤 대기 (0~2초)
  sleep(Math.random() * 2);
}

// 무거운 작업 시나리오
function heavyOperations(vu, iter) {
  const startTime = new Date().getTime();
  
  // 로그인
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    userId: `${STRESS_TEST_USER.userId}_${vu}`,
    password: STRESS_TEST_USER.password
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { scenario: 'heavy', operation: 'login' },
    timeout: '30s'
  });
  
  totalRequests.add(1);
  
  if (loginRes.status !== 201) {
    failedRequests.add(1);
    errorRate.add(1);
    return;
  }
  
  const token = loginRes.json('accessToken');
  successRate.add(1);
  
  // 대시보드 생성
  const dashboardRes = http.post(`${BASE_URL}/dashboard`, JSON.stringify({
    title: `Stress Test Dashboard ${vu}_${iter}`,
    description: `Heavy load test - VU: ${vu}, Iteration: ${iter}`,
    layout: generateLargeLayout(20)  // 20개 위젯 레이아웃
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    tags: { scenario: 'heavy', operation: 'dashboard-create' },
    timeout: '30s'
  });
  
  totalRequests.add(1);
  
  if (dashboardRes.status === 201) {
    successRate.add(1);
    const dashboardId = dashboardRes.json('data.id');
    
    // 다중 위젯 생성 (병렬)
    const widgetPromises = [];
    for (let i = 0; i < 5; i++) {
      const widgetRes = http.post(`${BASE_URL}/widget`, JSON.stringify({
        name: `Stress Widget ${vu}_${iter}_${i}`,
        dashboardId: dashboardId,
        datasetType: 'DATASET',
        datasetId: 1,
        componentType: ['bar', 'line', 'pie'][i % 3] + 'Chart',
        chartOptions: generateComplexChartOptions(),
        size: { x: i * 4, y: 0, w: 4, h: 4 }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        tags: { scenario: 'heavy', operation: 'widget-create' },
        timeout: '30s'
      });
      
      totalRequests.add(1);
      check(widgetRes, {
        'widget created': (r) => r.status === 201
      });
    }
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
  
  const endTime = new Date().getTime();
  responseTime.add(endTime - startTime);
}

// 중간 작업 시나리오
function mediumOperations(vu, iter) {
  const startTime = new Date().getTime();
  
  // 간소화된 로그인
  const token = quickLogin(vu);
  if (!token) return;
  
  // 데이터베이스 쿼리 실행
  const queries = [
    'SELECT COUNT(*) FROM test_table',
    'SELECT * FROM metrics WHERE date > NOW() - INTERVAL 7 DAY',
    'SELECT category, SUM(value) FROM data GROUP BY category',
    'SELECT DISTINCT user_id FROM activity_log ORDER BY timestamp DESC LIMIT 100'
  ];
  
  queries.forEach((query, index) => {
    const queryRes = http.post(`${BASE_URL}/database/execute-query`, JSON.stringify({
      id: 1,  // 기본 테스트 DB
      query: query,
      parameters: [],
      limit: 1000
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      tags: { scenario: 'medium', operation: `query-${index}` },
      timeout: '20s'
    });
    
    totalRequests.add(1);
    
    if (queryRes.status === 200) {
      successRate.add(1);
    } else {
      failedRequests.add(1);
      errorRate.add(1);
    }
  });
  
  const endTime = new Date().getTime();
  responseTime.add(endTime - startTime);
}

// 가벼운 작업 시나리오
function lightOperations(vu, iter) {
  const startTime = new Date().getTime();
  
  const token = quickLogin(vu);
  if (!token) return;
  
  // 읽기 전용 작업들
  const endpoints = [
    '/dashboard',
    '/widget',
    '/component',
    '/template',
    '/dataset'
  ];
  
  endpoints.forEach(endpoint => {
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { scenario: 'light', operation: `get-${endpoint}` },
      timeout: '10s'
    });
    
    totalRequests.add(1);
    
    if (res.status === 200) {
      successRate.add(1);
    } else {
      failedRequests.add(1);
      errorRate.add(1);
    }
  });
  
  const endTime = new Date().getTime();
  responseTime.add(endTime - startTime);
}

// 빠른 로그인 헬퍼
function quickLogin(vu) {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    userId: `${STRESS_TEST_USER.userId}_${vu}`,
    password: STRESS_TEST_USER.password
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s'
  });
  
  totalRequests.add(1);
  
  if (loginRes.status === 201) {
    successRate.add(1);
    return loginRes.json('accessToken');
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    return null;
  }
}

// 대형 레이아웃 생성
function generateLargeLayout(count) {
  const layout = [];
  const cols = 12;
  const rowHeight = 4;
  
  for (let i = 0; i < count; i++) {
    layout.push({
      i: `widget-${i}`,
      x: (i * 4) % cols,
      y: Math.floor((i * 4) / cols) * rowHeight,
      w: 4,
      h: rowHeight
    });
  }
  
  return layout;
}

// 복잡한 차트 옵션 생성
function generateComplexChartOptions() {
  return {
    type: 'line',
    title: { text: 'Stress Test Chart' },
    xAxis: { type: 'category', data: generateTimeSeriesLabels(100) },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Series 1',
        type: 'line',
        data: generateRandomData(100),
        smooth: true
      },
      {
        name: 'Series 2', 
        type: 'line',
        data: generateRandomData(100),
        smooth: true
      }
    ],
    tooltip: { trigger: 'axis' },
    legend: { data: ['Series 1', 'Series 2'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }
  };
}

// 시계열 레이블 생성
function generateTimeSeriesLabels(count) {
  const labels = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getTime() - i * 60 * 60 * 1000);
    labels.push(date.toISOString());
  }
  
  return labels.reverse();
}

// 랜덤 데이터 생성
function generateRandomData(count) {
  const data = [];
  let prev = 100;
  
  for (let i = 0; i < count; i++) {
    prev += Math.random() * 20 - 10;
    data.push(Math.max(0, prev));
  }
  
  return data;
}

// 테스트 요약 핸들러
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'stress-test-summary.json': JSON.stringify(data),
    'stress-test-summary.html': htmlReport(data),
  };
}

// 텍스트 요약 생성
function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  
  return `
${indent}=== STRESS TEST SUMMARY ===
${indent}
${indent}Total VUs: ${data.metrics.vus.max}
${indent}Total Requests: ${data.metrics.http_reqs.count}
${indent}Failed Requests: ${data.metrics.http_req_failed.count || 0}
${indent}Success Rate: ${((1 - data.metrics.http_req_failed.rate) * 100).toFixed(2)}%
${indent}
${indent}Response Times:
${indent}  Min: ${data.metrics.http_req_duration.min?.toFixed(2)}ms
${indent}  Med: ${data.metrics.http_req_duration.med?.toFixed(2)}ms
${indent}  Avg: ${data.metrics.http_req_duration.avg?.toFixed(2)}ms
${indent}  P95: ${data.metrics.http_req_duration['p(95)']?.toFixed(2)}ms
${indent}  P99: ${data.metrics.http_req_duration['p(99)']?.toFixed(2)}ms
${indent}  Max: ${data.metrics.http_req_duration.max?.toFixed(2)}ms
${indent}
${indent}Throughput: ${(data.metrics.http_reqs.rate || 0).toFixed(2)} req/s
${indent}
${indent}=========================
  `;
}

// HTML 리포트 생성
function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>VanillaMeta Stress Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; background: #f0f0f0; }
        .success { color: green; }
        .failure { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <h1>VanillaMeta Stress Test Report</h1>
    <div class="metric">
        <h3>Test Summary</h3>
        <p>Duration: ${new Date(data.state.testRunDurationMs).toISOString()}</p>
        <p>Max VUs: ${data.metrics.vus.max}</p>
        <p>Total Requests: ${data.metrics.http_reqs.count}</p>
    </div>
    <div class="metric">
        <h3>Performance Metrics</h3>
        <p>Success Rate: <span class="${data.metrics.http_req_failed.rate < 0.3 ? 'success' : 'failure'}">${((1 - data.metrics.http_req_failed.rate) * 100).toFixed(2)}%</span></p>
        <p>Average Response Time: ${data.metrics.http_req_duration.avg?.toFixed(2)}ms</p>
        <p>P95 Response Time: ${data.metrics.http_req_duration['p(95)']?.toFixed(2)}ms</p>
        <p>Throughput: ${data.metrics.http_reqs.rate?.toFixed(2)} req/s</p>
    </div>
</body>
</html>
  `;
}