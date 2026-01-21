import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 커스텀 메트릭
const errorRate = new Rate('spike_errors');
const recoveryTime = new Trend('recovery_time');

// 스파이크 테스트 설정 - 갑작스런 트래픽 증가 시뮬레이션
export const options = {
  stages: [
    // 안정 상태
    { duration: '2m', target: 10 },     // 2분 동안 10명 유지
    
    // 갑작스런 증가 (스파이크)
    { duration: '30s', target: 100 },   // 30초 만에 100명으로 급증
    
    // 유지
    { duration: '1m', target: 100 },    // 1분 동안 100명 유지
    
    // 회복
    { duration: '30s', target: 10 },    // 30초 만에 10명으로 감소
    
    // 안정화 확인
    { duration: '2m', target: 10 },     // 2분 동안 안정화 확인
  ],
  
  thresholds: {
    // 스파이크 테스트는 임시적 성능 저하를 허용
    http_req_failed: ['rate<0.15'],           // 에러율 15% 미만
    http_req_duration: ['p(95)<3000'],        // 95%가 3초 이내
    spike_errors: ['rate<0.15'],              // 스파이크 시 에러율
    recovery_time: ['p(95)<5000'],            // 회복 시간 5초 이내
  },
  
  tags: {
    test_type: 'spike',
    test_name: 'vanillameta_spike_test',
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

export default function() {
  const startTime = Date.now();
  
  // 현재 VU 수에 따라 시나리오 조정
  const currentVUs = __VU;
  
  group('Spike Test Scenario', function() {
    // 인증
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      userId: `spikeuser_${currentVUs}`,
      password: 'spike123'
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'spike', operation: 'login' },
      timeout: '30s'
    });
    
    const loginSuccess = check(loginRes, {
      'spike login successful': (r) => r.status === 201 || r.status === 429, // Rate limiting 허용
    });
    
    errorRate.add(!loginSuccess);
    
    if (loginRes.status === 201) {
      const token = loginRes.json('accessToken');
      
      // 핵심 API 호출 (스파이크 시 가장 영향받는 부분)
      const dashboardRes = http.get(`${BASE_URL}/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` },
        tags: { scenario: 'spike', operation: 'dashboard-list' },
        timeout: '20s'
      });
      
      check(dashboardRes, {
        'spike dashboard list success': (r) => r.status === 200 || r.status === 503, // 서비스 사용불가 허용
      });
      
      // 위젯 목록 (캐시된 데이터)
      const widgetRes = http.get(`${BASE_URL}/widget`, {
        headers: { 'Authorization': `Bearer ${token}` },
        tags: { scenario: 'spike', operation: 'widget-list' },
        timeout: '15s'
      });
      
      check(widgetRes, {
        'spike widget list success': (r) => r.status === 200,
      });
      
      // 컴포넌트 목록 (정적 데이터)
      const componentRes = http.get(`${BASE_URL}/component`, {
        headers: { 'Authorization': `Bearer ${token}` },
        tags: { scenario: 'spike', operation: 'component-list' },
        timeout: '10s'
      });
      
      check(componentRes, {
        'spike component list success': (r) => r.status === 200,
      });
    }
    
    // 회복 시간 측정
    const endTime = Date.now();
    recoveryTime.add(endTime - startTime);
  });
  
  // 스파이크 중에는 대기 시간 단축
  const currentStage = getCurrentStage();
  if (currentStage === 'spike') {
    sleep(0.5); // 스파이크 중에는 짧은 대기
  } else {
    sleep(Math.random() * 2 + 1); // 정상 시에는 1-3초 대기
  }
}

// 현재 테스트 단계 판단
function getCurrentStage() {
  const elapsed = Math.floor((__ENV.K6_DURATION || 0) / 1000);
  
  if (elapsed < 120) return 'stable';
  if (elapsed < 150) return 'spike';
  if (elapsed < 210) return 'sustain';
  if (elapsed < 240) return 'recovery';
  return 'stabilize';
}

export function handleSummary(data) {
  const spikePhaseMetrics = {
    spike_error_rate: data.metrics.spike_errors?.rate || 0,
    recovery_p95: data.metrics.recovery_time?.['p(95)'] || 0,
    overall_success_rate: (1 - (data.metrics.http_req_failed?.rate || 0)) * 100,
    peak_response_time: data.metrics.http_req_duration?.max || 0,
  };
  
  return {
    'stdout': `
=== SPIKE TEST SUMMARY ===

Spike Phase Performance:
- Error Rate During Spike: ${(spikePhaseMetrics.spike_error_rate * 100).toFixed(2)}%
- Recovery Time P95: ${spikePhaseMetrics.recovery_p95.toFixed(2)}ms
- Overall Success Rate: ${spikePhaseMetrics.overall_success_rate.toFixed(2)}%
- Peak Response Time: ${spikePhaseMetrics.peak_response_time.toFixed(2)}ms

System Resilience Assessment:
${spikePhaseMetrics.spike_error_rate < 0.15 ? '✅ PASS' : '❌ FAIL'} - Error rate within acceptable range
${spikePhaseMetrics.recovery_p95 < 5000 ? '✅ PASS' : '❌ FAIL'} - Recovery time acceptable
${spikePhaseMetrics.overall_success_rate > 85 ? '✅ PASS' : '❌ FAIL'} - Overall success rate acceptable

Recommendations:
${spikePhaseMetrics.spike_error_rate > 0.1 ? '- Consider implementing circuit breakers\n- Review rate limiting configuration\n' : ''}
${spikePhaseMetrics.recovery_p95 > 3000 ? '- Optimize database connection pooling\n- Review Lambda warm-up strategy\n' : ''}

========================
    `,
    'spike-test-results.json': JSON.stringify(data),
  };
}