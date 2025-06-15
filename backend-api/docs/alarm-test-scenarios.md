# VanillaMeta CloudWatch 알람 테스트 시나리오

## 테스트 개요

이 문서는 VanillaMeta의 CloudWatch 알람이 정상적으로 작동하는지 검증하기 위한 테스트 시나리오를 제공합니다.

## 테스트 환경 준비

### 1. 테스트용 Lambda 함수 생성
```javascript
// test-alarm-trigger.js
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

exports.handler = async (event) => {
    const { alarmType, severity } = event;
    
    switch(alarmType) {
        case 'error':
            // 의도적으로 에러 발생
            throw new Error('Test alarm: Simulated error');
            
        case 'memory':
            // 메모리 과다 사용 시뮬레이션
            const bigArray = new Array(100000000).fill('x');
            return { statusCode: 200, body: 'Memory test completed' };
            
        case 'latency':
            // 지연 시뮬레이션
            await new Promise(resolve => setTimeout(resolve, 4000));
            return { statusCode: 200, body: 'Latency test completed' };
            
        default:
            return { statusCode: 200, body: 'Test completed' };
    }
};
```

### 2. 테스트 API 엔드포인트
```typescript
// src/test/test.controller.ts
import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('테스트')
@Controller('test')
export class TestController {
  @Post('trigger-alarm')
  @ApiOperation({ summary: '알람 테스트 트리거' })
  async triggerAlarm(
    @Body() body: { type: string; count?: number },
    @Headers('X-Test-Mode') testMode: string,
  ) {
    if (testMode !== 'true') {
      return { error: 'Test mode not enabled' };
    }

    switch (body.type) {
      case 'error':
        // 에러 발생
        for (let i = 0; i < (body.count || 10); i++) {
          throw new Error(`Test error ${i}`);
        }
        break;

      case 'slow-query':
        // 느린 쿼리 실행
        await new Promise(resolve => setTimeout(resolve, 5000));
        break;

      case 'memory-leak':
        // 메모리 누수 시뮬레이션
        global.leakedObjects = global.leakedObjects || [];
        for (let i = 0; i < 1000000; i++) {
          global.leakedObjects.push(new Array(1000).fill('leak'));
        }
        break;
    }

    return { message: 'Alarm test triggered' };
  }
}
```

## 테스트 시나리오

### 시나리오 1: Lambda 에러율 알람 테스트

#### 목적
Lambda 함수 에러율이 5% 초과 시 Critical 알람이 발생하는지 확인

#### 테스트 단계
1. **베이스라인 확인**
   ```bash
   # 현재 에러율 확인
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --dimensions Name=FunctionName,Value=vanillameta-backend-api-prod-serverlessExpressLambdaFunction \
     --statistics Sum \
     --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300
   ```

2. **에러 발생**
   ```bash
   # 에러 발생 스크립트
   for i in {1..15}; do
     curl -X POST https://api.vanillameta.com/v1/test/trigger-alarm \
       -H "Content-Type: application/json" \
       -H "X-Test-Mode: true" \
       -d '{"type": "error", "count": 1}'
     sleep 2
   done
   ```

3. **알람 확인**
   - 5분 이내 알람 발생 확인
   - 이메일/Slack 알림 수신 확인

4. **복구 확인**
   - 정상 요청으로 에러율 낮추기
   - OK 상태 알림 확인

### 시나리오 2: API 응답시간 알람 테스트

#### 목적
API 평균 응답시간이 3초 초과 시 알람이 발생하는지 확인

#### 테스트 단계
1. **느린 응답 시뮬레이션**
   ```bash
   # 느린 응답 테스트
   for i in {1..10}; do
     curl -X POST https://api.vanillameta.com/v1/test/trigger-alarm \
       -H "Content-Type: application/json" \
       -H "X-Test-Mode: true" \
       -d '{"type": "slow-query"}' &
   done
   wait
   ```

2. **메트릭 확인**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ApiGateway \
     --metric-name Latency \
     --dimensions Name=ApiName,Value=vanillameta-backend-api-prod \
     --statistics Average \
     --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300
   ```

3. **알람 동작 확인**
   - Critical 알람 발생 확인
   - 알림 채널 확인

### 시나리오 3: Lambda 메모리 사용량 알람 테스트

#### 목적
Lambda 메모리 사용량이 80% 초과 시 알람이 발생하는지 확인

#### 테스트 단계
1. **메모리 부하 생성**
   ```javascript
   // 메모리 부하 테스트 함수
   async function memoryLoadTest() {
     const axios = require('axios');
     
     // 대용량 데이터 생성
     const response = await axios.post('https://api.vanillameta.com/v1/test/memory-load', {
       size: '2GB',
       duration: '120s'
     }, {
       headers: {
         'X-Test-Mode': 'true'
       }
     });
     
     console.log('Memory load test:', response.data);
   }
   ```

2. **CloudWatch 메트릭 확인**
   ```bash
   # 커스텀 메트릭 확인
   aws cloudwatch get-metric-statistics \
     --namespace VanillaMeta/Lambda \
     --metric-name MemoryUtilization \
     --dimensions Name=FunctionName,Value=vanillameta-backend-api-prod-serverlessExpressLambdaFunction \
     --statistics Maximum \
     --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300
   ```

### 시나리오 4: RDS CPU 사용률 알람 테스트

#### 목적
RDS CPU 사용률이 70% 초과 시 알람이 발생하는지 확인

#### 테스트 단계
1. **CPU 부하 생성 쿼리**
   ```sql
   -- CPU 집약적 쿼리 실행
   WITH RECURSIVE cpu_intensive AS (
     SELECT 1 as n, md5(random()::text) as hash
     UNION ALL
     SELECT n + 1, md5(random()::text || hash)
     FROM cpu_intensive
     WHERE n < 1000000
   )
   SELECT count(*), max(length(hash))
   FROM cpu_intensive;
   ```

2. **동시 다발적 쿼리 실행**
   ```bash
   # 병렬 쿼리 실행 스크립트
   for i in {1..20}; do
     psql -h $RDS_ENDPOINT -U $DB_USER -d $DB_NAME \
       -c "SELECT pg_sleep(1); SELECT count(*) FROM large_table;" &
   done
   wait
   ```

3. **RDS 메트릭 모니터링**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/RDS \
     --metric-name CPUUtilization \
     --dimensions Name=DBInstanceIdentifier,Value=vanillameta-prod \
     --statistics Average \
     --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300
   ```

### 시나리오 5: 다중 알람 동시 발생 테스트

#### 목적
여러 알람이 동시에 발생할 때 모든 알림이 정상적으로 전달되는지 확인

#### 테스트 단계
1. **동시 다발적 문제 발생**
   ```bash
   # 동시에 여러 문제 트리거
   ./trigger-multiple-alarms.sh
   ```

   ```bash
   #!/bin/bash
   # trigger-multiple-alarms.sh
   
   echo "Triggering multiple alarms..."
   
   # Lambda 에러 발생
   curl -X POST https://api.vanillameta.com/v1/test/trigger-alarm \
     -H "X-Test-Mode: true" \
     -d '{"type": "error", "count": 20}' &
   
   # API 지연 발생
   for i in {1..5}; do
     curl -X POST https://api.vanillameta.com/v1/test/trigger-alarm \
       -H "X-Test-Mode: true" \
       -d '{"type": "slow-query"}' &
   done
   
   # 메모리 부하
   curl -X POST https://api.vanillameta.com/v1/test/trigger-alarm \
     -H "X-Test-Mode: true" \
     -d '{"type": "memory-leak"}' &
   
   wait
   echo "All alarm triggers completed"
   ```

2. **알림 수신 확인**
   - 모든 알람에 대한 이메일 수신
   - Slack 채널의 알림 순서 및 내용 확인
   - 알람 우선순위별 정렬 확인

### 시나리오 6: 알람 억제(Suppression) 테스트

#### 목적
유지보수 모드에서 알람이 억제되는지 확인

#### 테스트 단계
1. **알람 억제 설정**
   ```bash
   # CloudWatch 알람 비활성화
   aws cloudwatch disable-alarm-actions \
     --alarm-names "vanillameta-prod-Lambda-Error-Rate-Critical" \
                   "vanillameta-prod-API-Latency-Critical"
   ```

2. **문제 상황 발생**
   - 에러 및 지연 트리거
   - 알림이 발생하지 않는지 확인

3. **알람 재활성화**
   ```bash
   # CloudWatch 알람 활성화
   aws cloudwatch enable-alarm-actions \
     --alarm-names "vanillameta-prod-Lambda-Error-Rate-Critical" \
                   "vanillameta-prod-API-Latency-Critical"
   ```

## 테스트 검증 체크리스트

### 알람 발생 검증
- [ ] 알람이 설정된 임계값에서 정확히 발생하는가?
- [ ] 평가 기간이 올바르게 적용되는가?
- [ ] 알람 상태 전환이 정상적으로 작동하는가?

### 알림 전달 검증
- [ ] 이메일 알림이 5분 이내에 도착하는가?
- [ ] Slack 알림이 정상적으로 표시되는가?
- [ ] 알림 내용이 충분한 정보를 포함하는가?

### 알람 해제 검증
- [ ] 문제 해결 후 OK 상태로 전환되는가?
- [ ] OK 상태 알림이 전달되는가?
- [ ] 알람 이력이 올바르게 기록되는가?

### 성능 영향 검증
- [ ] 알람 평가가 시스템 성능에 영향을 주지 않는가?
- [ ] 대량의 메트릭 수집이 문제를 일으키지 않는가?

## 테스트 결과 기록

### 테스트 로그 템플릿
```markdown
## 알람 테스트 결과 - [날짜]

### 테스트 환경
- 환경: Dev/Prod
- 테스터: [이름]
- 테스트 시간: YYYY-MM-DD HH:MM:SS KST

### 테스트 시나리오별 결과

#### 시나리오 1: Lambda 에러율
- 결과: Pass/Fail
- 알람 발생 시간: X분 Y초
- 알림 수신: 이메일(O), Slack(O)
- 비고: 

#### 시나리오 2: API 응답시간
- 결과: Pass/Fail
- 알람 발생 시간: X분 Y초
- 알림 수신: 이메일(O), Slack(O)
- 비고:

### 발견된 이슈
1. [이슈 설명]
2. [이슈 설명]

### 개선 권장사항
1. [개선 사항]
2. [개선 사항]
```

## 자동화된 테스트

### 일일 헬스체크
```python
# daily-alarm-health-check.py
import boto3
import time
from datetime import datetime

class AlarmHealthChecker:
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.logs = boto3.client('logs')
    
    def check_alarm_state(self, alarm_name):
        """알람 상태 확인"""
        response = self.cloudwatch.describe_alarms(
            AlarmNames=[alarm_name]
        )
        
        if response['MetricAlarms']:
            alarm = response['MetricAlarms'][0]
            return {
                'name': alarm['AlarmName'],
                'state': alarm['StateValue'],
                'enabled': alarm['ActionsEnabled'],
                'last_updated': alarm['StateUpdatedTimestamp']
            }
        return None
    
    def test_metric_publication(self, namespace, metric_name):
        """메트릭 발행 테스트"""
        try:
            self.cloudwatch.put_metric_data(
                Namespace=namespace,
                MetricData=[
                    {
                        'MetricName': f'Test_{metric_name}',
                        'Value': 1,
                        'Timestamp': datetime.utcnow()
                    }
                ]
            )
            return True
        except Exception as e:
            print(f"Metric publication failed: {e}")
            return False
    
    def run_health_check(self):
        """전체 헬스체크 실행"""
        alarms_to_check = [
            'vanillameta-prod-Lambda-Error-Rate-Critical',
            'vanillameta-prod-API-Latency-Critical',
            'vanillameta-prod-Lambda-Memory-Usage',
            'vanillameta-prod-RDS-CPU-Usage'
        ]
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'alarms': {},
            'metrics': {}
        }
        
        # 알람 상태 확인
        for alarm in alarms_to_check:
            results['alarms'][alarm] = self.check_alarm_state(alarm)
        
        # 메트릭 발행 테스트
        test_metrics = [
            ('VanillaMeta/Lambda', 'HealthCheck'),
            ('VanillaMeta/Business', 'HealthCheck')
        ]
        
        for namespace, metric in test_metrics:
            results['metrics'][f'{namespace}/{metric}'] = \
                self.test_metric_publication(namespace, metric)
        
        return results

if __name__ == '__main__':
    checker = AlarmHealthChecker()
    results = checker.run_health_check()
    print(json.dumps(results, indent=2))
```