import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// API별 특화 메트릭
const dashboardApiMetrics = new Trend('dashboard_api_response');
const widgetApiMetrics = new Trend('widget_api_response');
const datasetApiMetrics = new Trend('dataset_api_response');
const queryApiMetrics = new Trend('query_api_response');
const authApiMetrics = new Trend('auth_api_response');
const apiSpecificErrors = new Rate('api_specific_errors');

// API별 특화 테스트 설정
export const options = {
  stages: [
    { duration: '2m', target: 20 },     // 준비
    { duration: '5m', target: 50 },     // 안정화
    { duration: '3m', target: 100 },    // 부하 증가
    { duration: '2m', target: 20 },     // 감소
  ],
  
  thresholds: {
    // API별 특화 임계값
    dashboard_api_response: ['p(95)<1500'],     // 대시보드 API 1.5초 이내
    widget_api_response: ['p(95)<1000'],        // 위젯 API 1초 이내
    dataset_api_response: ['p(95)<800'],        // 데이터셋 API 0.8초 이내
    query_api_response: ['p(95)<3000'],         // 쿼리 API 3초 이내 (복잡한 쿼리 허용)
    auth_api_response: ['p(95)<500'],           // 인증 API 0.5초 이내
    api_specific_errors: ['rate<0.05'],         // API별 에러율 5% 미만
  },
  
  tags: {
    test_type: 'api_specific',
    test_name: 'vanillameta_api_specific_test',
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

export default function() {
  // 시나리오 가중치 기반 선택
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    // 30% - 대시보드 중심 워크플로우
    dashboardWorkflow();
  } else if (scenario < 0.5) {
    // 20% - 위젯 중심 워크플로우  
    widgetWorkflow();
  } else if (scenario < 0.7) {
    // 20% - 데이터 쿼리 중심 워크플로우
    dataQueryWorkflow();
  } else if (scenario < 0.9) {
    // 20% - 데이터셋 관리 워크플로우
    datasetWorkflow();
  } else {
    // 10% - 혼합 워크플로우
    mixedWorkflow();
  }
  
  sleep(Math.random() * 3 + 1);
}

// 대시보드 중심 워크플로우
function dashboardWorkflow() {
  group('Dashboard API Workflow', function() {
    const token = authenticate();
    if (!token) return;
    
    // 대시보드 목록 조회 (가장 빈번한 작업)
    const listStart = Date.now();
    const listRes = http.get(`${BASE_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { api: 'dashboard', operation: 'list' },
      timeout: '10s'
    });
    dashboardApiMetrics.add(Date.now() - listStart);
    
    const listSuccess = check(listRes, {
      'dashboard list success': (r) => r.status === 200,
      'dashboard list has data': (r) => r.json('data') && Array.isArray(r.json('data')),
    });
    apiSpecificErrors.add(!listSuccess);
    
    if (listSuccess) {
      const dashboards = listRes.json('data');
      
      if (dashboards.length > 0) {
        // 특정 대시보드 조회
        const dashboardId = dashboards[Math.floor(Math.random() * dashboards.length)].id;
        const detailStart = Date.now();
        const detailRes = http.get(`${BASE_URL}/dashboard/${dashboardId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { api: 'dashboard', operation: 'detail' },
          timeout: '10s'
        });
        dashboardApiMetrics.add(Date.now() - detailStart);
        
        check(detailRes, {
          'dashboard detail success': (r) => r.status === 200,
        });
      }
      
      // 대시보드 생성 (10% 확률)
      if (Math.random() < 0.1) {
        const createStart = Date.now();
        const createRes = http.post(`${BASE_URL}/dashboard`, JSON.stringify({
          title: `API Test Dashboard ${Date.now()}`,
          description: 'Created during API specific testing',
          layout: generateDashboardLayout()
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          tags: { api: 'dashboard', operation: 'create' },
          timeout: '15s'
        });
        dashboardApiMetrics.add(Date.now() - createStart);
        
        const createSuccess = check(createRes, {
          'dashboard create success': (r) => r.status === 201,
        });
        
        if (createSuccess) {
          const newDashboardId = createRes.json('data.id');
          
          // 생성된 대시보드 업데이트
          sleep(1);
          const updateStart = Date.now();
          const updateRes = http.patch(`${BASE_URL}/dashboard/${newDashboardId}`, JSON.stringify({
            title: `Updated API Test Dashboard ${Date.now()}`
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            tags: { api: 'dashboard', operation: 'update' },
            timeout: '10s'
          });
          dashboardApiMetrics.add(Date.now() - updateStart);
          
          check(updateRes, {
            'dashboard update success': (r) => r.status === 200,
          });
        }
      }
    }
  });
}

// 위젯 중심 워크플로우
function widgetWorkflow() {
  group('Widget API Workflow', function() {
    const token = authenticate();
    if (!token) return;
    
    // 위젯 목록 조회
    const listStart = Date.now();
    const listRes = http.get(`${BASE_URL}/widget`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { api: 'widget', operation: 'list' },
      timeout: '8s'
    });
    widgetApiMetrics.add(Date.now() - listStart);
    
    const listSuccess = check(listRes, {
      'widget list success': (r) => r.status === 200,
    });
    apiSpecificErrors.add(!listSuccess);
    
    // 위젯 생성 (20% 확률)
    if (Math.random() < 0.2) {
      const createStart = Date.now();
      const createRes = http.post(`${BASE_URL}/widget`, JSON.stringify({
        name: `API Test Widget ${Date.now()}`,
        dashboardId: 1,
        datasetType: 'DATASET',
        datasetId: 1,
        componentType: getRandomChartType(),
        chartOptions: generateChartOptions(),
        size: { x: 0, y: 0, w: 4, h: 4 }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        tags: { api: 'widget', operation: 'create' },
        timeout: '15s'
      });
      widgetApiMetrics.add(Date.now() - createStart);
      
      const createSuccess = check(createRes, {
        'widget create success': (r) => r.status === 201,
      });
      
      if (createSuccess) {
        const widgetId = createRes.json('data.id');
        
        // 위젯 데이터 조회
        sleep(1);
        const dataStart = Date.now();
        const dataRes = http.get(`${BASE_URL}/widget/${widgetId}/data`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { api: 'widget', operation: 'data' },
          timeout: '20s'
        });
        widgetApiMetrics.add(Date.now() - dataStart);
        
        check(dataRes, {
          'widget data success': (r) => r.status === 200,
        });
      }
    }
    
    // 컴포넌트 목록 조회 (위젯 생성 시 필요)
    const componentStart = Date.now();
    const componentRes = http.get(`${BASE_URL}/component`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { api: 'component', operation: 'list' },
      timeout: '5s'
    });
    widgetApiMetrics.add(Date.now() - componentStart);
    
    check(componentRes, {
      'component list success': (r) => r.status === 200,
    });
  });
}

// 데이터 쿼리 중심 워크플로우
function dataQueryWorkflow() {
  group('Data Query API Workflow', function() {
    const token = authenticate();
    if (!token) return;
    
    // 데이터베이스 목록 조회
    const dbListStart = Date.now();
    const dbListRes = http.get(`${BASE_URL}/database`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { api: 'database', operation: 'list' },
      timeout: '8s'
    });
    queryApiMetrics.add(Date.now() - dbListStart);
    
    const dbListSuccess = check(dbListRes, {
      'database list success': (r) => r.status === 200,
    });
    
    if (dbListSuccess) {
      const databases = dbListRes.json('data');
      
      if (databases && databases.length > 0) {
        const database = databases[0];
        
        // 다양한 복잡도의 쿼리 실행
        const queries = [
          // 간단한 쿼리
          'SELECT 1 as simple_test',
          // 집계 쿼리
          'SELECT COUNT(*) as total FROM test_table',
          // 조인 쿼리 (시뮬레이션)
          'SELECT a.id, b.name FROM table_a a JOIN table_b b ON a.id = b.ref_id LIMIT 100',
          // 복잡한 집계
          'SELECT category, COUNT(*) as count, AVG(value) as avg_value FROM data GROUP BY category ORDER BY count DESC'
        ];
        
        const selectedQuery = queries[Math.floor(Math.random() * queries.length)];
        
        const queryStart = Date.now();
        const queryRes = http.post(`${BASE_URL}/database/execute-query`, JSON.stringify({
          id: database.id,
          query: selectedQuery,
          parameters: [],
          limit: 1000
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          tags: { api: 'query', operation: 'execute' },
          timeout: '30s'
        });
        queryApiMetrics.add(Date.now() - queryStart);
        
        const querySuccess = check(queryRes, {
          'query execute success': (r) => r.status === 200 || r.status === 400, // 400은 SQL 문법 오류 허용
        });
        apiSpecificErrors.add(!querySuccess && queryRes.status !== 400);
      }
    }
  });
}

// 데이터셋 관리 워크플로우
function datasetWorkflow() {
  group('Dataset API Workflow', function() {
    const token = authenticate();
    if (!token) return;
    
    // 데이터셋 목록 조회
    const listStart = Date.now();
    const listRes = http.get(`${BASE_URL}/dataset`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { api: 'dataset', operation: 'list' },
      timeout: '8s'
    });
    datasetApiMetrics.add(Date.now() - listStart);
    
    const listSuccess = check(listRes, {
      'dataset list success': (r) => r.status === 200,
    });
    apiSpecificErrors.add(!listSuccess);
    
    // 템플릿 목록 조회 (데이터셋과 관련)
    const templateStart = Date.now();
    const templateRes = http.get(`${BASE_URL}/template`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { api: 'template', operation: 'list' },
      timeout: '8s'
    });
    datasetApiMetrics.add(Date.now() - templateStart);
    
    check(templateRes, {
      'template list success': (r) => r.status === 200,
    });
    
    // 데이터셋 생성 (15% 확률)
    if (Math.random() < 0.15) {
      const createStart = Date.now();
      const createRes = http.post(`${BASE_URL}/dataset`, JSON.stringify({
        name: `API Test Dataset ${Date.now()}`,
        description: 'Created during API testing',
        databaseId: 1,
        query: 'SELECT * FROM test_data LIMIT 1000',
        parameters: []
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        tags: { api: 'dataset', operation: 'create' },
        timeout: '20s'
      });
      datasetApiMetrics.add(Date.now() - createStart);
      
      check(createRes, {
        'dataset create success': (r) => r.status === 201,
      });
    }
  });
}

// 혼합 워크플로우
function mixedWorkflow() {
  group('Mixed API Workflow', function() {
    const token = authenticate();
    if (!token) return;
    
    // 여러 API를 동시에 호출 (일반적인 앱 로딩 시나리오)
    const batchRequests = [
      ['GET', `${BASE_URL}/dashboard`, null, { headers: { 'Authorization': `Bearer ${token}` }}],
      ['GET', `${BASE_URL}/widget`, null, { headers: { 'Authorization': `Bearer ${token}` }}],
      ['GET', `${BASE_URL}/component`, null, { headers: { 'Authorization': `Bearer ${token}` }}],
      ['GET', `${BASE_URL}/template`, null, { headers: { 'Authorization': `Bearer ${token}` }}],
    ];
    
    const batchStart = Date.now();
    const responses = http.batch(batchRequests);
    const batchDuration = Date.now() - batchStart;
    
    // 각 API별 메트릭 기록
    dashboardApiMetrics.add(responses[0].timings.duration);
    widgetApiMetrics.add(responses[1].timings.duration);
    widgetApiMetrics.add(responses[2].timings.duration); // 컴포넌트는 위젯 관련
    datasetApiMetrics.add(responses[3].timings.duration); // 템플릿은 데이터셋 관련
    
    responses.forEach((res, index) => {
      const success = check(res, {
        [`batch request ${index} success`]: (r) => r.status === 200,
      });
      apiSpecificErrors.add(!success);
    });
    
    console.log(`Batch request completed in ${batchDuration}ms`);
  });
}

// 인증 헬퍼
function authenticate() {
  const authStart = Date.now();
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    userId: `apitest_${__VU}`,
    password: 'apitest123'
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { api: 'auth', operation: 'login' },
    timeout: '10s'
  });
  authApiMetrics.add(Date.now() - authStart);
  
  const authSuccess = check(loginRes, {
    'auth success': (r) => r.status === 201,
  });
  apiSpecificErrors.add(!authSuccess);
  
  return authSuccess ? loginRes.json('accessToken') : null;
}

// 헬퍼 함수들
function generateDashboardLayout() {
  return [
    { i: 'widget-1', x: 0, y: 0, w: 6, h: 4 },
    { i: 'widget-2', x: 6, y: 0, w: 6, h: 4 },
    { i: 'widget-3', x: 0, y: 4, w: 12, h: 4 },
  ];
}

function getRandomChartType() {
  const types = ['barChart', 'lineChart', 'pieChart', 'scatterChart', 'areaChart'];
  return types[Math.floor(Math.random() * types.length)];
}

function generateChartOptions() {
  return {
    type: 'bar',
    title: { text: 'API Test Chart' },
    xAxis: { type: 'category' },
    yAxis: { type: 'value' },
    series: [{ name: 'Test Data', type: 'bar', data: [10, 20, 30, 40, 50] }]
  };
}

export function handleSummary(data) {
  const apiMetrics = {
    dashboard: {
      avg: data.metrics.dashboard_api_response?.avg || 0,
      p95: data.metrics.dashboard_api_response?.['p(95)'] || 0,
    },
    widget: {
      avg: data.metrics.widget_api_response?.avg || 0,
      p95: data.metrics.widget_api_response?.['p(95)'] || 0,
    },
    dataset: {
      avg: data.metrics.dataset_api_response?.avg || 0,
      p95: data.metrics.dataset_api_response?.['p(95)'] || 0,
    },
    query: {
      avg: data.metrics.query_api_response?.avg || 0,
      p95: data.metrics.query_api_response?.['p(95)'] || 0,
    },
    auth: {
      avg: data.metrics.auth_api_response?.avg || 0,
      p95: data.metrics.auth_api_response?.['p(95)'] || 0,
    },
  };
  
  return {
    'stdout': `
=== API SPECIFIC TEST SUMMARY ===

Performance by API:

Dashboard API:
- Average: ${apiMetrics.dashboard.avg.toFixed(2)}ms
- P95: ${apiMetrics.dashboard.p95.toFixed(2)}ms
- Status: ${apiMetrics.dashboard.p95 < 1500 ? '✅ PASS' : '❌ FAIL'}

Widget API:
- Average: ${apiMetrics.widget.avg.toFixed(2)}ms  
- P95: ${apiMetrics.widget.p95.toFixed(2)}ms
- Status: ${apiMetrics.widget.p95 < 1000 ? '✅ PASS' : '❌ FAIL'}

Dataset API:
- Average: ${apiMetrics.dataset.avg.toFixed(2)}ms
- P95: ${apiMetrics.dataset.p95.toFixed(2)}ms  
- Status: ${apiMetrics.dataset.p95 < 800 ? '✅ PASS' : '❌ FAIL'}

Query API:
- Average: ${apiMetrics.query.avg.toFixed(2)}ms
- P95: ${apiMetrics.query.p95.toFixed(2)}ms
- Status: ${apiMetrics.query.p95 < 3000 ? '✅ PASS' : '❌ FAIL'}

Auth API:
- Average: ${apiMetrics.auth.avg.toFixed(2)}ms
- P95: ${apiMetrics.auth.p95.toFixed(2)}ms
- Status: ${apiMetrics.auth.p95 < 500 ? '✅ PASS' : '❌ FAIL'}

Overall API Error Rate: ${((data.metrics.api_specific_errors?.rate || 0) * 100).toFixed(2)}%

API Performance Ranking:
1. ${Object.entries(apiMetrics).sort((a, b) => a[1].avg - b[1].avg).map(([name, metric]) => `${name}: ${metric.avg.toFixed(2)}ms`).join('\n')}

=================================
    `,
    'api-specific-test-results.json': JSON.stringify({
      api_metrics: apiMetrics,
      raw_data: data
    }),
  };
}