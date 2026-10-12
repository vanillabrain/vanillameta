# Rill 수익 모델과 agent-first 분석 시장

조사일: 2026-10-12 KST. 공식 가격·문서·소스·제공사 사례 기준. 실제 ARR, 흑자 여부, 플랜별 매출 비중은 확인하지 못했다. 기능의 정확성·속도·설치 부담은 직접 비교 실행하지 않았다.

## Rill의 공개 범위와 매출 구조

[공개 저장소](https://github.com/rilldata/rill)는 [Apache-2.0](https://github.com/rilldata/rill/blob/main/LICENSE.md)이다. 로컬 개발 환경과 분석 runtime을 공개하지만, 운영되는 Rill Cloud 서비스의 무상 제공까지 뜻하지 않는다. 저장소에는 admin 관련 코드도 있으므로 “Cloud 코드는 전부 비공개”라고 단정하지 않는다. 로컬 개발과 팀용 운영 서비스의 역할은 [공식 비교](https://docs.rilldata.com/developers/deploy/cloud-vs-developer)에 설명되어 있다.

[현재 가격](https://www.rilldata.com/pricing): Starter $20/seat/month, Growth $30/seat/month, Enterprise 연간 플랫폼 계약/견적. 호스팅 프로젝트 compute 별도. Growth embedding은 $500/month(활성 embedded seat 100개까지). Starter compute $0.15/unit-hour. 공식 예시의 2 seats+1 project×2 units×720h는 $40+$216=$256/month이며 세금·AI/API 초과분·최초 $250 credit을 제외한 견적이다. 이 구성은 보편적 최소요금이나 모든 배포의 실제 청구액이 아니다. BYO DB/AI는 외부 공급자 비용과 플랫폼 계약을 없애지 않는다.

가격의 의미에 대한 분석: 무료 로컬 도입 → 실제 데이터로 프로젝트 생성 → 팀에 지속 제공/관리 → 유료 platform·compute·embedding·기업 계약으로 연결되는 경로다. 이것은 공개 제품/가격에서 추론한 사업 구조이며 전환율·수익성은 확인하지 않았다. 오픈소스가 제공하는 것은 코드 접근과 직접 운영 선택이고, 유료 서비스는 운영 책임·협업·확장·지원의 가치를 판다.

Rill의 [오디오 광고 플랫폼 사례](https://www.rilldata.com/powering-self-serve-analytics-for-a-leading-audio-advertising-platform)는 다수 고객에게 배포되는 분석과 도입 지원을 보여준다. 데이터 지연 개선과 화면 조회 속도는 별도 지표다. 제공사 성공 사례이며 독립 검증이나 Rill의 기업 전체 매출 자료는 아니다.

## Agent-first를 구분하는 기준

1. Builder: 데이터를 연결하고 모델·지표·화면을 수정하는 에이전트.
2. Analyst: 지표를 조회하고 기간/차원을 바꿔 조사하며 결과 근거를 제시하는 에이전트.
3. Operator: 수집 실패·스키마 변화·최신성 문제를 관리하는 에이전트/자동화.

MCP 지원, 자연어→SQL, 데이터 Q&A만으로 위 세 역할을 모두 제공한다고 볼 수 없다. 자연어가 UI를 대체해도 데이터 의미·기간·키·권한·최신성 정의는 남는다.

Rill은 [공식 agent architecture](https://www.rilldata.com/blog/rill-agentic-architecture-analytics-for-the-ai-era)에서 Builder/Analyst를 구분하고 같은 metrics runtime/tool contract를 공유한다. Builder는 변경 후 상태/오류를 읽고 반복하며 Analyst는 주로 정의된 지표를 조회한다. Schema·권한·결과 크기 제한과 평가 사례가 설계에 포함된다. 이 설명은 아키텍처 참고이며 무오류 성능을 입증하지 않는다.

[로컬 agent workflow](https://docs.rilldata.com/developers/get-started/ai-quickstart)는 SQL/YAML과 외부 AI coding agent 및 로컬 MCP를 활용한다. [분석 MCP](https://docs.rilldata.com/guide/ai/mcp)는 지표·정의·기간 조회를 제공한다. 로컬 계산과 오프라인 AI는 별개다.

## 비교할 서비스

| 서비스 | 핵심 역할/준비 사항 | 공개·유료 경계와 참고 링크 |
| --- | --- | --- |
| Rill | 로컬 Builder + 지표 기반 Analyst, 모델/정의가 필요 | 공개 runtime/개발 환경, 유료 Cloud·compute·embedding·기업 계약 |
| Evidence | SQL/Markdown으로 보고서 생성·수정; 데이터팀/코딩 agent 작업과 연결 | [Core](https://evidence.dev/blog/evidence-core)와 [Studio](https://evidence.dev/blog/evidence-studio) 구분, [Cloud 가격](https://evidence.dev/pricing) |
| Wren AI | 의미/컨텍스트 모델을 통해 agent 질의·SQL·분석; 데이터 연결/업무 정의 필요 | [현재 가격](https://www.getwren.ai/pricing?tab=self-hosted)은 무료 CLI/engine(no UI), 유료 cloud usage credits, enterprise self-host simultaneous sessions 구분. [OSS 저장소](https://github.com/Canner/WrenAI)에는 여러 license 파일이 있어 활용 시 선택 버전·디렉터리의 실제 license 확인 필요 |
| Lightdash | dbt/지표 기반 self-service + [agent/MCP](https://docs.lightdash.com/agents); warehouse/정의 준비. beta 차트/대시보드 편집과 reviewed Git 기반 의미 모델 변경 안내 | [가격](https://www.lightdash.com/pricing): OSS와 Cloud/Enterprise 분리. Agent/MCP가 OSS에도 모두 포함된다고 가정하지 않음 |
| Hex | 대화형 Analyst→분석 notebook/data app, 승인 데이터/semantic model 우선 | [Threads](https://learn.hex.tech/docs/explore-data/threads), [가격](https://hex.tech/pricing/): 유료 editor/enterprise·AI credits·추가 compute. 무료 Community는 OSS 의미가 아님 |
| Databox | 기존 연결/정의된 KPI를 외부 AI가 조회, [AI Analyst](https://databox.com/ai-analyst)의 지표/대시보드/보고서 생성 | [MCP](https://databox.com/mcp), 클라우드 서비스와 지표 context 중심. 로컬 프로젝트 코드 편집과는 역할이 다름. unattended Agents의 출시 상태는 별도로 확인해야 함 |

공통점에 대한 판단: 경쟁의 중심은 채팅 UI에서 데이터 의미/권한/실행/근거를 제공하는 분석 runtime으로 이동하고 있다. 공개 기능 설명에서 나온 시장 방향 가설이며 서비스별 실제 품질 순위는 아니다.

Wren은 현 가격 페이지(no UI)와 일부 OSS edition 문서의 MCP/dashboard 설명에 차이가 있다. 도입 검토에서는 배포 버전과 기능을 직접 확인해야 한다. 현재 [license map](https://github.com/Canner/WrenAI/blob/main/LICENSE)은 core/SDK/skills/examples Apache-2.0, 문서 CC BY 4.0을 구분한다. 다른 license 파일의 존재만으로 현재 core 전체를 AGPL이라고 판단하지 않는다.

## VanillaMeta의 추천 포지션

범용 Rill 대체재가 아니라, “데이터팀 없는 운영자가 국내 주문·환불·정산 파일을 반복 갱신하고, 숫자의 기준을 자연어로 수정·확인하는 BI”를 우선 검증한다. 국내 파일 지원, 한국어, 로컬 보관 하나만으로 장기 방어력이 생기지는 않는다. 실제 mapping·키/환불 규칙·변경 이력·반복 갱신 품질과 고객 유입 경로를 함께 만들어야 한다.

기술적으로 재사용할 원칙:
- 현재 Metric의 단일집계를 확장하기 전에 첫 업무 지표의 정의·버전·기간·통화·완전성을 고정한다.
- Web/MCP가 같은 조회 서비스를 호출한다. AI가 별도 계산을 만들어 다른 숫자를 내지 않게 한다.
- schema 검사, 지표 조회, 원본 근거, draft patch, validation 상태, preview/undo를 제한된 tool로 정의한다.
- 처음부터 router/여러 specialist agent를 구성하지 않는다. 단일 agent+작은 tool 집합, 반복/토큰/조회 예산부터 시작한다.
- 승인된 정의 변경과 결과 diff를 저장한다. AI 모델/도구/정의 변경 때만 고정 정답 평가를 반복한다.
- raw sample 몇 행의 요약을 전체 데이터 원인 분석으로 제시하지 않는다. 상관/기여도 설명과 인과적 원인을 구분한다.

## 직접 개발과 활용 판단

| 선택 | 이점 | 추가 부담 |
| --- | --- | --- |
| 기존 VanillaMeta를 좁게 개선 | React/Nest·화면을 유지, 업무 온보딩 자유도 | 수집/버전/공통 지표/tool contract 개발 |
| Rill을 분석 runtime으로 사용 | 모델·지표·agent 기반을 재사용할 후보 | Go/Svelte 운영, 인증/프로젝트/배포·API·UX 연결, 업스트림 추적 |
| Rill fork/전체 제품 전환 | 기반 기능을 넓게 확보 | 가장 큰 이전/유지보수 부담; 가격·라이선스가 통합 난이도를 해결하지 않음 |

추천은 기존 제품 유지와 수집 MVP 진행을 기본으로 하되, 본격적인 범용 agent runtime 개발 전에 **범위가 제한된 Rill 비교 실험**을 수행하는 것이다. 현 대시보드를 전면 교체하거나 코드 fork를 즉시 결정하지 않는다.

실험 입력: 동일한 비식별 주문/환불 fixture와 2개 파일 형식. 작업: 첫 화면 생성, 같은 파일 재수집, 뒤늦은 환불, 컬럼 변경, 지표 기준 변경/undo, 모델 질의 근거, 로컬 재시작 후 복원. 고정 정답은 기존 [MVP 계획](2026-10-12-ingestion-sales-mvp-plan.md)의 계약 사용.

측정: 설치/최초 연결 시간, 사람의 수동 개입, 수치 정답, 필요한 custom glue 코드, 서버/AI 비용, 반복 갱신, 권한 경계. 2~3 engineer-days라는 시간 상한을 제안하며 성능/통합 완료의 약속은 아니다. AI 응답 지연과 원천 데이터 최신성은 별도 측정한다.

판정: Rill이 계산/분석 core 대부분을 대체하고 온보딩·권한·운영 연결 부담이 적으면 runtime 재사용을 우선한다. 모델/화면·인증 두 체계를 계속 유지해야 하거나 원래 workflow를 크게 바꿔야 하면 자체 좁은 구현을 유지한다. 시간 상한 내 검증되지 않으면 근거 없이 전환하지 않는다.

## 수익화 가설

무료/공개 후보: 파일 분석·기본 업무 지표·검증·내보내기·제한적 local preview/MCP, 데이터 이동성. VanillaMeta 현재 package의 private/UNLICENSED 표시와 별개로 공개 대상의 저작권/의존성을 확인하고 명시적으로 license를 결정해야 한다. 이 문서는 공개 전환을 실행하지 않는다.

유료 후보: 지속 수집·hosting·backup/restore·공유 workspace·API connector 운영·정기 보고, 제한된 AI 분석/편집, 지원. 회사별 기본 요금+source/data/AI 한도를 먼저 시험하고, 작은 조직에서 조회 사용자 수가 확산을 막지 않도록 설계한다. 구체 금액은 아직 고객 검증 전이다.

고객 제안은 token이 아니라 “다음 파일도 같은 기준으로 갱신된다”는 업무 결과 중심으로 한다. 내부 원가는 compute/storage/model/support 단위로 추적하고 AI 무제한을 약속하지 않는다. 자사 BI 기능이 아니라 외부 Cloud embedding을 활용하면 Rill 플랫폼/compute/embedding 비용과 당사 지원비를 함께 계산해야 한다.

서비스 비용과 반복 구독을 분리한다. 최초 mapping 설정만 대행하는 것은 프로젝트 매출일 수 있으나 갱신 운영의 반복 사용·유료 전환이 확인되지 않으면 SaaS 가설은 검증되지 않는다.

후속 순서: 실제 고객 파일/기준 확보 → 기존 수집 MVP와 bounded Rill benchmark → 적용 runtime 결정 → 공통 지표+읽기 MCP → 제한적 AI draft 편집 → 지속 운영 유료화 검증. 이번 작업은 조사·문서이며 설치·통합·성능검증·제품 변경은 실행하지 않았다.
