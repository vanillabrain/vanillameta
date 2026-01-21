# T06_S06: 운영 가이드 및 트러블슈팅

## 태스크 개요
- **ID**: T06_S06
- **제목**: 운영팀을 위한 종합 가이드 및 트러블슈팅 문서 작성
- **우선순위**: Medium
- **예상 소요 시간**: 3일
- **담당**: DevOps 엔지니어, 백엔드 개발자

## 목표
운영팀이 VanillaMeta 시스템을 효과적으로 관리하고, 문제 발생 시 신속하게 대응할 수 있도록 상세한 운영 가이드와 트러블슈팅 매뉴얼을 작성합니다.

## 구현 범위

### 1. 운영 가이드 구조
```yaml
OperationsGuide:
  1_시스템아키텍처:
    - 전체 아키텍처 다이어그램
    - 컴포넌트별 역할 및 책임
    - 데이터 흐름도
    - 외부 의존성
  
  2_일상운영:
    - 시스템 모니터링 체크리스트
    - 정기 점검 항목
    - 로그 관리 및 분석
    - 백업 및 복구 절차
    - 보안 점검 사항
  
  3_배포관리:
    - 배포 프로세스
    - 롤백 절차
    - 환경별 설정 관리
    - 배포 전/후 체크리스트
  
  4_성능관리:
    - 성능 모니터링 지표
    - 성능 튜닝 가이드
    - 스케일링 전략
    - 리소스 최적화
  
  5_보안운영:
    - 접근 권한 관리
    - 보안 패치 적용
    - 감사 로그 관리
    - 인시던트 대응
```

### 2. 트러블슈팅 가이드
```yaml
TroubleshootingGuide:
  CommonIssues:
    HighLatency:
      symptoms: ["API 응답 시간 증가", "대시보드 로딩 지연"]
      diagnostics: ["CloudWatch 메트릭 확인", "Lambda 콜드 스타트 확인"]
      solutions: ["Lambda 예약 동시성 설정", "API Gateway 캐싱 활성화"]
    
    DatabaseConnection:
      symptoms: ["Connection timeout", "Too many connections"]
      diagnostics: ["RDS 연결 수 확인", "보안 그룹 설정 확인"]
      solutions: ["연결 풀 크기 조정", "유휴 연결 타임아웃 설정"]
    
    OutOfMemory:
      symptoms: ["Lambda 함수 실패", "ENOMEM 오류"]
      diagnostics: ["CloudWatch Logs 확인", "메모리 사용량 분석"]
      solutions: ["Lambda 메모리 증가", "코드 최적화"]
  
  EmergencyProcedures:
    SystemDown:
      immediate_actions: ["상태 확인", "임시 공지", "장애 원인 파악"]
      recovery_steps: ["서비스 재시작", "데이터 무결성 확인", "정상화 확인"]
      post_mortem: ["원인 분석", "개선 방안 도출", "문서 업데이트"]
```

### 3. 운영 자동화 스크립트
```bash
#!/bin/bash
# operations/scripts/health-check.sh

# VanillaMeta 시스템 헬스체크 스크립트
set -e

ENVIRONMENT=${1:-production}
SLACK_WEBHOOK=${SLACK_WEBHOOK_URL}

echo "========================================="
echo "VanillaMeta Health Check - ${ENVIRONMENT}"
echo "Time: $(date)"
echo "========================================="

# 함수: 결과 리포팅
report_status() {
    local service=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "OK" ]; then
        echo "✅ ${service}: ${message}"
    else
        echo "❌ ${service}: ${message}"
        send_alert "${service}" "${message}"
    fi
}

# 함수: Slack 알림 전송
send_alert() {
    local service=$1
    local message=$2
    
    if [ ! -z "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 [${ENVIRONMENT}] ${service}: ${message}\"}" \
            $SLACK_WEBHOOK
    fi
}

# 1. API Gateway 헬스체크
echo -e "\n1. Checking API Gateway..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://api.vanillameta.com/health)
if [ "$API_RESPONSE" = "200" ]; then
    report_status "API Gateway" "OK" "Responding normally"
else
    report_status "API Gateway" "FAIL" "HTTP ${API_RESPONSE}"
fi

# 2. Lambda 함수 상태 확인
echo -e "\n2. Checking Lambda Functions..."
LAMBDA_ERRORS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value=vanillameta-api \
    --statistics Sum \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --query 'Datapoints[0].Sum' \
    --output text)

if [ "$LAMBDA_ERRORS" = "None" ] || [ "$LAMBDA_ERRORS" = "0" ]; then
    report_status "Lambda" "OK" "No errors in last 5 minutes"
else
    report_status "Lambda" "WARN" "${LAMBDA_ERRORS} errors in last 5 minutes"
fi

# 3. RDS 데이터베이스 상태
echo -e "\n3. Checking RDS Database..."
DB_STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier vanillameta-db \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text)

if [ "$DB_STATUS" = "available" ]; then
    report_status "RDS" "OK" "Database is available"
else
    report_status "RDS" "FAIL" "Database status: ${DB_STATUS}"
fi

# 4. S3 버킷 접근성
echo -e "\n4. Checking S3 Buckets..."
S3_CHECK=$(aws s3 ls s3://vanillameta-assets --max-items 1 2>&1)
if [ $? -eq 0 ]; then
    report_status "S3" "OK" "Bucket accessible"
else
    report_status "S3" "FAIL" "Cannot access bucket"
fi

# 5. CloudFront 분산 상태
echo -e "\n5. Checking CloudFront..."
CF_STATUS=$(aws cloudfront get-distribution \
    --id ${CLOUDFRONT_DISTRIBUTION_ID} \
    --query 'Distribution.Status' \
    --output text)

if [ "$CF_STATUS" = "Deployed" ]; then
    report_status "CloudFront" "OK" "Distribution is deployed"
else
    report_status "CloudFront" "WARN" "Distribution status: ${CF_STATUS}"
fi

echo -e "\n========================================="
echo "Health check completed at $(date)"
echo "========================================="
```

### 4. 트러블슈팅 플레이북
```typescript
// backend-api/src/operations/troubleshooting-playbook.ts

interface TroubleshootingCase {
  id: string;
  title: string;
  symptoms: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  diagnosticSteps: DiagnosticStep[];
  solutions: Solution[];
  preventiveMeasures: string[];
}

interface DiagnosticStep {
  step: number;
  description: string;
  command?: string;
  expectedOutput?: string;
  nextStepIf: {
    condition: string;
    goto: number;
  }[];
}

interface Solution {
  id: string;
  description: string;
  steps: string[];
  risks: string[];
  estimatedTime: string;
}

export const troubleshootingPlaybook: TroubleshootingCase[] = [
  {
    id: 'high-api-latency',
    title: 'API 응답 지연',
    symptoms: [
      'API 응답 시간이 2초 이상',
      '사용자가 "로딩이 느려요" 불만 제기',
      'P99 레이턴시 알람 발생',
    ],
    severity: 'high',
    diagnosticSteps: [
      {
        step: 1,
        description: 'CloudWatch에서 API Gateway 메트릭 확인',
        command: 'aws cloudwatch get-metric-statistics --namespace AWS/ApiGateway --metric-name Latency --dimensions Name=ApiName,Value=vanillameta-api --statistics Average,Maximum --start-time 2024-01-01T00:00:00Z --end-time 2024-01-01T01:00:00Z --period 300',
        expectedOutput: 'Average latency < 500ms',
        nextStepIf: [
          { condition: 'latency > 1000ms', goto: 2 },
          { condition: 'latency < 1000ms', goto: 3 },
        ],
      },
      {
        step: 2,
        description: 'Lambda 함수 성능 분석',
        command: 'aws logs insights query --log-group-name /aws/lambda/vanillameta-api --start-time 1h --query "fields @timestamp, duration | stats avg(duration), max(duration) by bin(5m)"',
        nextStepIf: [
          { condition: 'cold start detected', goto: 4 },
          { condition: 'memory pressure', goto: 5 },
        ],
      },
      {
        step: 3,
        description: 'RDS 성능 메트릭 확인',
        command: 'aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name CPUUtilization --dimensions Name=DBInstanceIdentifier,Value=vanillameta-db',
        nextStepIf: [
          { condition: 'CPU > 80%', goto: 6 },
          { condition: 'slow queries detected', goto: 7 },
        ],
      },
    ],
    solutions: [
      {
        id: 'enable-api-caching',
        description: 'API Gateway 캐싱 활성화',
        steps: [
          'API Gateway 콘솔 접속',
          '해당 API 선택 → Stages → Production',
          'Settings 탭에서 Enable API cache 체크',
          'Cache capacity: 0.5 GB 선택',
          'TTL: 300초 설정',
          'Deploy API',
        ],
        risks: ['캐시된 데이터로 인한 일시적 불일치 가능'],
        estimatedTime: '10분',
      },
      {
        id: 'lambda-reserved-concurrency',
        description: 'Lambda 예약 동시성 설정',
        steps: [
          'Lambda 콘솔에서 함수 선택',
          'Configuration → Concurrency',
          'Reserve concurrency: 10 설정',
          'Provisioned concurrency: 5 설정',
          'Save',
        ],
        risks: ['추가 비용 발생'],
        estimatedTime: '5분',
      },
    ],
    preventiveMeasures: [
      '정기적인 성능 테스트 수행',
      '트래픽 패턴 분석 및 예측',
      '자동 스케일링 정책 수립',
    ],
  },
  {
    id: 'database-connection-pool-exhausted',
    title: '데이터베이스 연결 풀 고갈',
    symptoms: [
      'Error: Too many connections',
      'Lambda 함수 타임아웃',
      'RDS 연결 수 한계 도달',
    ],
    severity: 'critical',
    diagnosticSteps: [
      {
        step: 1,
        description: '현재 DB 연결 수 확인',
        command: `mysql -h vanillameta-db.region.rds.amazonaws.com -u admin -p -e "SHOW STATUS WHERE Variable_name = 'Threads_connected';"`,
        expectedOutput: 'Threads_connected < 80',
        nextStepIf: [
          { condition: 'connections > 90', goto: 2 },
        ],
      },
      {
        step: 2,
        description: '활성 연결 상세 정보 확인',
        command: `mysql -e "SELECT id, user, host, db, command, time, state FROM information_schema.processlist WHERE command != 'Sleep' ORDER BY time DESC;"`,
        nextStepIf: [
          { condition: 'long running queries found', goto: 3 },
          { condition: 'zombie connections found', goto: 4 },
        ],
      },
    ],
    solutions: [
      {
        id: 'kill-zombie-connections',
        description: '좀비 연결 종료',
        steps: [
          '장시간 유휴 연결 식별',
          'KILL [connection_id] 명령으로 연결 종료',
          'Lambda 환경변수에서 연결 풀 크기 축소',
          '연결 타임아웃 설정 강화',
        ],
        risks: ['진행 중인 트랜잭션 롤백 가능'],
        estimatedTime: '15분',
      },
      {
        id: 'increase-max-connections',
        description: 'RDS max_connections 증가',
        steps: [
          'RDS Parameter Group 수정',
          'max_connections: 200으로 증가',
          'DB 인스턴스 재시작 (다운타임 발생)',
        ],
        risks: ['5-10분 다운타임 발생'],
        estimatedTime: '20분',
      },
    ],
    preventiveMeasures: [
      '연결 풀 모니터링 대시보드 구축',
      '연결 누수 감지 로직 구현',
      'RDS Proxy 도입 검토',
    ],
  },
];

// 트러블슈팅 실행 엔진
export class TroubleshootingEngine {
  async runDiagnostics(caseId: string): Promise<DiagnosticResult> {
    const playbook = troubleshootingPlaybook.find(p => p.id === caseId);
    if (!playbook) {
      throw new Error(`Playbook not found: ${caseId}`);
    }

    const results: StepResult[] = [];
    let currentStep = 1;

    while (currentStep <= playbook.diagnosticSteps.length) {
      const step = playbook.diagnosticSteps.find(s => s.step === currentStep);
      if (!step) break;

      const result = await this.executeStep(step);
      results.push(result);

      // 다음 단계 결정
      const nextStep = this.determineNextStep(step, result);
      if (nextStep === -1) break;
      currentStep = nextStep;
    }

    return {
      caseId,
      timestamp: new Date(),
      results,
      recommendedSolutions: this.analyzeSolutions(playbook, results),
    };
  }

  private async executeStep(step: DiagnosticStep): Promise<StepResult> {
    console.log(`Executing step ${step.step}: ${step.description}`);
    
    if (step.command) {
      try {
        const output = await this.runCommand(step.command);
        return {
          step: step.step,
          success: true,
          output,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        return {
          step: step.step,
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      step: step.step,
      success: true,
      output: 'Manual check required',
      duration: 0,
    };
  }
}
```

### 5. 운영 대시보드
```typescript
// frontend-web/src/components/operations/OperationsDashboard.tsx
import React, { useState, useEffect } from 'react';
import { SystemHealth } from './SystemHealth';
import { AlertsPanel } from './AlertsPanel';
import { MetricsChart } from './MetricsChart';
import { TroubleshootingWizard } from './TroubleshootingWizard';

export function OperationsDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>();
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  useEffect(() => {
    // 실시간 시스템 상태 구독
    const ws = new WebSocket('wss://api.vanillameta.com/operations/status');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSystemStatus(data.status);
      setActiveAlerts(data.alerts);
    };

    return () => ws.close();
  }, []);

  return (
    <div className="operations-dashboard">
      <header>
        <h1>VanillaMeta Operations Center</h1>
        <div className="status-badge">
          System Status: <StatusIndicator status={systemStatus?.overall} />
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="system-health">
          <h2>System Health</h2>
          <SystemHealth status={systemStatus} />
        </section>

        <section className="alerts">
          <h2>Active Alerts ({activeAlerts.length})</h2>
          <AlertsPanel 
            alerts={activeAlerts}
            onInvestigate={(alert) => {
              setShowTroubleshooting(true);
              // 관련 트러블슈팅 가이드 열기
            }}
          />
        </section>

        <section className="metrics">
          <h2>Key Metrics</h2>
          <MetricsChart 
            metrics={[
              { name: 'API Latency', unit: 'ms' },
              { name: 'Error Rate', unit: '%' },
              { name: 'Active Users', unit: 'count' },
            ]}
          />
        </section>

        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button onClick={() => runHealthCheck()}>
              🔍 Run Health Check
            </button>
            <button onClick={() => clearCache()}>
              🗑️ Clear Cache
            </button>
            <button onClick={() => restartServices()}>
              🔄 Restart Services
            </button>
            <button onClick={() => setShowTroubleshooting(true)}>
              🛠️ Troubleshooting
            </button>
          </div>
        </section>
      </div>

      {showTroubleshooting && (
        <TroubleshootingWizard
          onClose={() => setShowTroubleshooting(false)}
          initialSymptom={activeAlerts[0]?.type}
        />
      )}
    </div>
  );
}
```

### 6. 인시던트 관리 시스템
```yaml
# operations/incident-response.yml
incident_response:
  severity_levels:
    P1_Critical:
      description: "전체 서비스 중단"
      response_time: "5분 이내"
      escalation: ["On-call Engineer", "Team Lead", "CTO"]
      communication: ["Slack #incidents", "SMS", "Status Page"]
    
    P2_High:
      description: "주요 기능 장애"
      response_time: "15분 이내"
      escalation: ["On-call Engineer", "Team Lead"]
      communication: ["Slack #incidents", "Email"]
    
    P3_Medium:
      description: "부분적 기능 저하"
      response_time: "1시간 이내"
      escalation: ["On-call Engineer"]
      communication: ["Slack #incidents"]
    
    P4_Low:
      description: "마이너 이슈"
      response_time: "4시간 이내"
      escalation: ["Team"]
      communication: ["Slack #team"]

  response_phases:
    1_detection:
      - "알람 수신 또는 이슈 발견"
      - "심각도 평가"
      - "인시던트 생성"
    
    2_response:
      - "On-call 엔지니어 소집"
      - "War Room 개설"
      - "초기 조사 시작"
      - "임시 조치 적용"
    
    3_recovery:
      - "근본 원인 파악"
      - "해결책 구현"
      - "서비스 복구"
      - "정상 작동 확인"
    
    4_post_mortem:
      - "타임라인 작성"
      - "원인 분석"
      - "개선 사항 도출"
      - "문서 업데이트"

  templates:
    incident_report: |
      ## Incident Report #[NUMBER]
      
      **Date**: [YYYY-MM-DD]
      **Time**: [HH:MM] - [HH:MM] KST
      **Duration**: [X hours Y minutes]
      **Severity**: [P1/P2/P3/P4]
      **Impact**: [Affected users/features]
      
      ### Summary
      [Brief description of the incident]
      
      ### Timeline
      - [HH:MM] - Detection: [How was it detected]
      - [HH:MM] - Response: [Initial actions taken]
      - [HH:MM] - Mitigation: [Temporary fixes]
      - [HH:MM] - Resolution: [Final fix applied]
      - [HH:MM] - Verification: [Service restored]
      
      ### Root Cause
      [Detailed explanation of what caused the incident]
      
      ### Resolution
      [Steps taken to resolve the issue]
      
      ### Lessons Learned
      - What went well
      - What could be improved
      
      ### Action Items
      - [ ] [Preventive measure 1]
      - [ ] [Preventive measure 2]
      - [ ] [Documentation update]
```

## 검증 항목

### 문서 완성도
- [ ] 모든 주요 운영 시나리오 포함
- [ ] 트러블슈팅 케이스 20개 이상
- [ ] 스크립트 및 명령어 검증 완료
- [ ] 다이어그램 및 플로우차트 포함

### 실용성
- [ ] 운영팀 피드백 반영
- [ ] 실제 인시던트 사례 기반
- [ ] 단계별 가이드 명확성
- [ ] 예상 소요 시간 정확도

### 자동화
- [ ] 헬스체크 스크립트 자동 실행
- [ ] 트러블슈팅 위자드 구현
- [ ] 인시던트 리포트 자동 생성

## 산출물
1. 운영 가이드 문서 (PDF/HTML)
2. 트러블슈팅 플레이북
3. 운영 자동화 스크립트 모음
4. 운영 대시보드 웹 인터페이스
5. 인시던트 대응 템플릿

## 참고 자료
- [SRE Book by Google](https://sre.google/sre-book/table-of-contents/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Incident Management Best Practices](https://www.atlassian.com/incident-management)