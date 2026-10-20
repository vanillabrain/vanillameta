# VanillaMeta 캐시 모니터링 및 메트릭 시스템

## 개요

VanillaMeta의 캐시 모니터링 시스템은 실시간 성능 추적, 알림, 분석을 제공하여 캐시 시스템의 효율성과 안정성을 보장합니다.

## 구성 요소

### 1. 캐시 모니터링 서비스 (`CacheMonitoringService`)

실시간 캐시 성능 메트릭을 수집하고 분석합니다.

#### 주요 기능
- 1분마다 자동 메트릭 수집
- L1/L2 캐시 통계 추적
- 성능 임계값 모니터링
- 캐시 효율성 계산

#### 수집 메트릭
```typescript
interface CacheMetrics {
  l1: {
    hitRate: number;        // 히트율
    totalHits: number;      // 총 히트 수
    totalMisses: number;    // 총 미스 수
    size: number;           // 현재 크기
    memoryUsage: number;    // 메모리 사용량
    evictions: number;      // 제거된 항목 수
  };
  l2: {
    hitRate: number;        // Redis 히트율
    keyCount: number;       // 키 개수
    connectionStatus: string; // 연결 상태
    latency: {             // 지연 시간 통계
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  overall: {
    hitRate: number;        // 전체 히트율
    totalRequests: number;  // 총 요청 수
    cacheEfficiency: number; // 효율성 점수 (0-100)
    avgResponseTime: number; // 평균 응답 시간
  };
}
```

### 2. 캐시 알림 서비스 (`CacheAlertService`)

성능 저하나 문제 발생 시 자동으로 알림을 발송합니다.

#### 알림 규칙
| 규칙 | 조건 | 심각도 | 알림 채널 |
|------|------|--------|-----------|
| 낮은 히트율 | < 70% | warning | Log, Slack |
| 위험한 히트율 | < 50% | critical | Log, Email, Slack |
| 높은 지연 시간 | > 100ms | warning | Log |
| Redis 연결 끊김 | disconnected | critical | Log, Email, Slack |
| 메모리 부족 | > 90% | warning | Log, Slack |

#### 알림 채널
- **Log**: 시스템 로그에 기록
- **Email**: 관리자 이메일로 발송
- **Slack**: Slack 웹훅으로 실시간 알림
- **Webhook**: 커스텀 웹훅 호출

### 3. L1 캐시 서비스 (`L1CacheService`)

메모리 기반 캐시의 관리와 통계를 담당합니다.

#### 특징
- LRU(Least Recently Used) 정책 사용
- 엔진별 독립적인 캐시 공간
- 자동 메모리 관리
- 실시간 통계 추적

## API 엔드포인트

### 모니터링 API

#### 1. 현재 메트릭 조회
```bash
GET /api/v1/cache/monitoring/metrics/current?engine=dashboard

Response:
{
  "status": "success",
  "data": {
    "timestamp": 1698123456789,
    "engine": "dashboard",
    "l1": { ... },
    "l2": { ... },
    "overall": { ... }
  }
}
```

#### 2. 메트릭 히스토리 조회
```bash
GET /api/v1/cache/monitoring/metrics/history/dashboard?duration=86400000

Response:
{
  "status": "success",
  "data": {
    "engine": "dashboard",
    "duration": 86400000,
    "count": 1440,
    "metrics": [ ... ]
  }
}
```

#### 3. 캐시 상태 요약
```bash
GET /api/v1/cache/monitoring/summary

Response:
{
  "status": "success",
  "data": {
    "engines": [
      {
        "name": "dashboard",
        "status": "healthy",
        "hitRate": 0.85,
        "efficiency": 92.5,
        "issues": []
      }
    ],
    "overall": {
      "status": "healthy",
      "avgHitRate": 0.82,
      "avgEfficiency": 89.3,
      "totalRequests": 125000
    }
  }
}
```

#### 4. 성능 리포트 생성
```bash
GET /api/v1/cache/monitoring/report?duration=86400000&format=json

Response:
{
  "status": "success",
  "data": {
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-02T00:00:00Z"
    },
    "summary": {
      "avgHitRate": 0.78,
      "totalRequests": 250000,
      "totalHits": 195000,
      "totalMisses": 55000,
      "avgResponseTime": 15.2,
      "peakUsageTime": "2024-01-01T14:30:00Z"
    },
    "engines": [ ... ]
  }
}
```

#### 5. 캐시 권장사항
```bash
GET /api/v1/cache/monitoring/recommendations

Response:
{
  "status": "success",
  "data": {
    "ttl": {
      "dashboard": 3600,
      "dataset": 1800,
      "widget": 900
    },
    "memoryAllocation": {
      "dashboard": 1000,
      "dataset": 2000,
      "widget": 500
    },
    "warmupStrategy": [
      "매일 새벽 3시 인기 데이터셋 워밍업",
      "1시간마다 실시간 대시보드 갱신"
    ]
  }
}
```

#### 6. 캐시 건강도 체크
```bash
GET /api/v1/cache/monitoring/health

Response:
{
  "status": "healthy",
  "checks": {
    "l1Cache": true,
    "l2Cache": true,
    "redisConnection": true,
    "performanceThresholds": true
  },
  "message": "모든 캐시 시스템이 정상 작동 중입니다."
}
```

## 모니터링 대시보드 구성

### Grafana 대시보드 예제

```json
{
  "dashboard": {
    "title": "VanillaMeta Cache Monitoring",
    "panels": [
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "cache_hit_rate{engine=\"dashboard\"}"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "cache_response_time_avg{engine=\"dashboard\"}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "cache_memory_usage_bytes / cache_memory_max_bytes * 100"
          }
        ]
      }
    ]
  }
}
```

## 알림 설정 가이드

### 환경 변수 설정
```bash
# Slack 웹훅 URL
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# 알림 이메일 수신자
ALERT_EMAIL_RECIPIENTS=admin@example.com,devops@example.com

# 커스텀 웹훅 URL
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

### Slack 알림 형식
```json
{
  "username": "VanillaMeta Cache Monitor",
  "icon_emoji": ":warning:",
  "attachments": [{
    "color": "#FF0000",
    "title": "낮은 캐시 히트율 (dashboard)",
    "text": "캐시 히트율이 70% 미만으로 떨어짐",
    "fields": [
      {
        "title": "심각도",
        "value": "WARNING",
        "short": true
      },
      {
        "title": "엔진",
        "value": "dashboard",
        "short": true
      }
    ]
  }]
}
```

## 성능 최적화 전략

### 1. 메트릭 수집 최적화
```typescript
// 배치 처리로 성능 향상
const metrics = await Promise.all([
  this.getEngineMetrics('dashboard'),
  this.getEngineMetrics('dataset'),
  this.getEngineMetrics('widget')
]);
```

### 2. 알림 최적화
- Cooldown 기간 설정으로 중복 알림 방지
- 심각도별 알림 채널 차별화
- 배치 알림으로 알림 폭주 방지

### 3. 히스토리 관리
- 최대 24시간(1440개 데이터 포인트) 유지
- 오래된 데이터 자동 정리
- 압축 저장으로 메모리 절약

## 트러블슈팅

### 문제: 메트릭이 수집되지 않음
```bash
# 스케줄러 상태 확인
GET /api/v1/cache/monitoring/scheduler/status

# 수동 메트릭 수집 트리거
POST /api/v1/cache/monitoring/collect
```

### 문제: 알림이 발송되지 않음
```bash
# 알림 상태 확인
GET /api/v1/cache/alert/status

# 알림 규칙 확인
GET /api/v1/cache/alert/rules

# 알림 히스토리 조회
GET /api/v1/cache/alert/history
```

### 문제: 성능 저하
```bash
# 상세 진단 실행
POST /api/v1/cache/monitoring/diagnose

# 캐시 통계 리셋
POST /api/v1/cache/monitoring/reset-stats
```

## 모범 사례

1. **정기적인 리포트 검토**
   - 일일 성능 리포트 확인
   - 주간 트렌드 분석
   - 월간 최적화 계획 수립

2. **알림 관리**
   - 중요도별 알림 채널 설정
   - 팀별 알림 수신자 관리
   - 알림 피로도 방지 전략

3. **성능 목표 설정**
   - 히트율 목표: > 80%
   - 응답 시간 목표: < 50ms
   - 가용성 목표: > 99.9%

4. **문서화**
   - 알림 대응 절차 문서화
   - 성능 튜닝 이력 관리
   - 인시던트 포스트모템

## 연동 가이드

### Prometheus 연동
```yaml
scrape_configs:
  - job_name: 'vanillameta-cache'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/v1/cache/monitoring/metrics/prometheus'
```

### CloudWatch 연동
```typescript
// CloudWatch 메트릭 전송
await cloudWatch.putMetricData({
  Namespace: 'VanillaMeta/Cache',
  MetricData: [
    {
      MetricName: 'HitRate',
      Value: metrics.overall.hitRate,
      Unit: 'Percent',
      Dimensions: [
        { Name: 'Engine', Value: engine }
      ]
    }
  ]
}).promise();
```

## 추가 리소스

- [캐시 최적화 가이드](./CACHE_BEST_PRACTICES.md)
- [Redis 캐싱 전략](./REDIS_CACHING_STRATEGY.md)
- [쿼리 결과 캐싱 구현](./QUERY_RESULT_CACHING_IMPLEMENTATION.md)