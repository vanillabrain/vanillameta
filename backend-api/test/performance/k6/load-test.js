import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// 커스텀 메트릭 정의
const errorRate = new Rate('errors');
const apiTrend = new Trend('api_response_time');
const dbQueryTrend = new Trend('db_query_time');
const authTrend = new Trend('auth_response_time');

// 테스트 데이터 로드
const testUsers = new SharedArray('users', function() {
  return [
    { userId: 'testuser1', password: 'testpass123' },
    { userId: 'testuser2', password: 'testpass123' },
    { userId: 'testuser3', password: 'testpass123' },
    { userId: 'testuser4', password: 'testpass123' },
    { userId: 'testuser5', password: 'testpass123' }
  ];
});

// 테스트 설정
export const options = {
  stages: [
    // 준비 단계
    { duration: '1m', target: 10 },    // 1분 동안 10명까지 증가
    
    // 증가 단계
    { duration: '3m', target: 50 },    // 3분 동안 50명까지 증가
    
    // 안정화 단계  
    { duration: '5m', target: 50 },    // 5분 동안 50명 유지
    
    // 스트레스 단계
    { duration: '2m', target: 100 },   // 2분 동안 100명까지 증가
    
    // 회복 단계
    { duration: '2m', target: 10 },    // 2분 동안 10명으로 감소
  ],
  
  thresholds: {
    // HTTP 요청 성공률
    http_req_failed: ['rate<0.05'],        // 에러율 5% 미만
    
    // 응답 시간
    http_req_duration: [
      'p(95)<2000',                        // 95%가 2초 이내
      'p(99)<5000',                        // 99%가 5초 이내
    ],
    
    // 커스텀 메트릭
    errors: ['rate<0.05'],                 // 전체 에러율 5% 미만
    api_response_time: ['p(95)<2000'],     // API 응답 시간
    db_query_time: ['p(95)<1000'],         // DB 쿼리 시간
    auth_response_time: ['p(95)<1000'],    // 인증 응답 시간
  },
  
  // 추가 옵션
  noConnectionReuse: false,
  userAgent: 'VanillaMeta-K6-LoadTest/1.0',
};

// 기본 URL 설정
const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

// 테스트 설정 함수
export function setup() {
  console.log('Setting up load test...');
  
  // 관리자 로그인하여 초기 데이터 생성
  const adminLogin = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    userId: 'admin',
    password: 'admin123'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  const adminToken = adminLogin.json('accessToken');
  
  // 테스트용 데이터베이스 생성
  const testDb = http.post(`${BASE_URL}/database`, JSON.stringify({
    name: 'K6 Test Database',
    engine: 'sqlite3',
    connectionConfig: { filename: ':memory:' }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  });
  
  return {
    adminToken: adminToken,
    testDatabaseId: testDb.json('data.id')
  };
}

// 메인 테스트 시나리오
export default function(data) {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  let authToken = null;
  
  // 시나리오 1: 인증 플로우
  group('Authentication Flow', function() {
    // 로그인
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      userId: user.userId,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' }
    });
    
    authTrend.add(loginRes.timings.duration);
    
    const loginSuccess = check(loginRes, {
      'login successful': (r) => r.status === 201,
      'has access token': (r) => r.json('accessToken') !== undefined,
      'has refresh token': (r) => r.json('refreshToken') !== undefined
    });
    
    errorRate.add(!loginSuccess);
    
    if (loginSuccess) {
      authToken = loginRes.json('accessToken');
    } else {
      console.error(`Login failed for user ${user.userId}`);
      return;
    }
    
    sleep(1);
    
    // 프로필 조회
    const profileRes = http.get(`${BASE_URL}/user/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      tags: { name: 'profile' }
    });
    
    check(profileRes, {
      'profile retrieved': (r) => r.status === 200,
      'has user data': (r) => r.json('data.userId') === user.userId
    });
  });
  
  sleep(2);
  
  // 시나리오 2: 대시보드 작업
  group('Dashboard Operations', function() {
    // 대시보드 목록 조회
    const dashboardListRes = http.get(`${BASE_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      tags: { name: 'dashboard-list' }
    });
    
    apiTrend.add(dashboardListRes.timings.duration);
    
    const listSuccess = check(dashboardListRes, {
      'dashboard list retrieved': (r) => r.status === 200,
      'has data array': (r) => Array.isArray(r.json('data'))
    });
    
    errorRate.add(!listSuccess);
    
    // 대시보드 생성
    const createDashboardRes = http.post(`${BASE_URL}/dashboard`, JSON.stringify({
      title: `K6 Test Dashboard ${Date.now()}`,
      description: 'Load test dashboard',
      layout: []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      tags: { name: 'dashboard-create' }
    });
    
    const createSuccess = check(createDashboardRes, {
      'dashboard created': (r) => r.status === 201,
      'has dashboard id': (r) => r.json('data.id') !== undefined
    });
    
    let dashboardId = null;
    if (createSuccess) {
      dashboardId = createDashboardRes.json('data.id');
      
      // 대시보드 업데이트
      sleep(1);
      
      const updateRes = http.patch(`${BASE_URL}/dashboard/${dashboardId}`, JSON.stringify({
        title: `Updated Dashboard ${Date.now()}`
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        tags: { name: 'dashboard-update' }
      });
      
      check(updateRes, {
        'dashboard updated': (r) => r.status === 200
      });
    }
  });
  
  sleep(2);
  
  // 시나리오 3: 위젯 및 데이터 작업
  group('Widget and Data Operations', function() {
    // 위젯 목록 조회
    const widgetListRes = http.get(`${BASE_URL}/widget`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      tags: { name: 'widget-list' }
    });
    
    check(widgetListRes, {
      'widget list retrieved': (r) => r.status === 200
    });
    
    // 컴포넌트 목록 조회
    const componentRes = http.get(`${BASE_URL}/component`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      tags: { name: 'component-list' }
    });
    
    check(componentRes, {
      'component list retrieved': (r) => r.status === 200,
      'has components': (r) => r.json('data.length') > 0
    });
    
    // 데이터셋 조회
    const datasetRes = http.get(`${BASE_URL}/dataset`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      tags: { name: 'dataset-list' }
    });
    
    check(datasetRes, {
      'dataset list retrieved': (r) => r.status === 200
    });
  });
  
  sleep(2);
  
  // 시나리오 4: 데이터베이스 쿼리
  group('Database Query Operations', function() {
    if (data.testDatabaseId) {
      // 쿼리 실행
      const queryRes = http.post(`${BASE_URL}/database/execute-query`, JSON.stringify({
        id: data.testDatabaseId,
        query: 'SELECT 1 as test_col, random() as rand_val',
        parameters: [],
        limit: 100
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        tags: { name: 'db-query' }
      });
      
      dbQueryTrend.add(queryRes.timings.duration);
      
      const querySuccess = check(queryRes, {
        'query executed': (r) => r.status === 200 || r.status === 400,
        'has result': (r) => r.status === 200 ? r.json('datas') !== undefined : true
      });
      
      errorRate.add(!querySuccess && queryRes.status !== 400);
    }
  });
  
  sleep(2);
  
  // 시나리오 5: 동시성 테스트
  group('Concurrent Operations', function() {
    const batch = http.batch([
      // 동시에 여러 API 호출
      ['GET', `${BASE_URL}/dashboard`, null, { headers: { 'Authorization': `Bearer ${authToken}` }}],
      ['GET', `${BASE_URL}/widget`, null, { headers: { 'Authorization': `Bearer ${authToken}` }}],
      ['GET', `${BASE_URL}/component`, null, { headers: { 'Authorization': `Bearer ${authToken}` }}],
      ['GET', `${BASE_URL}/template`, null, { headers: { 'Authorization': `Bearer ${authToken}` }}],
    ]);
    
    batch.forEach((res, index) => {
      check(res, {
        [`concurrent request ${index} successful`]: (r) => r.status === 200
      });
    });
  });
  
  sleep(Math.random() * 3 + 1); // 1-4초 랜덤 대기
}

// 테스트 정리 함수
export function teardown(data) {
  console.log('Cleaning up load test data...');
  
  if (data.testDatabaseId && data.adminToken) {
    // 테스트 데이터베이스 삭제
    http.del(`${BASE_URL}/database/${data.testDatabaseId}`, null, {
      headers: { 'Authorization': `Bearer ${data.adminToken}` }
    });
  }
  
  console.log('Load test completed!');
}