# Requirements

2026-10-18 기업 데이터 Artifact 확장안: [요구사항 설계](strategy/enterprise-data-artifact.md). FR-013~028/NFR-005~010/C-004~006은 신규 목표이며 Open은 기존 기반이 전혀 없다는 뜻이 아니다. 기존 FR-001~012의 구현·검증 상태를 새 기업 정책에 자동 승계하지 않는다. 새 NFR 수치는 설계 목표이며 운영 SLA가 아니다.

## Functional Requirements

| ID     | Title                     | User Story                                                                                               | Priority | Status   |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------- | -------- | -------- |
| FR-001 | Consistent metric preview | As a 운영 담당자, I want 숫자 지표와 시계열을 함께 미리보기 so that 저장 결과를 예측할 수 있다.          | High     | Verified |
| FR-002 | Progressive settings      | As a 운영 담당자, I want 보조 설정을 필요할 때 펼치기 so that 결과를 먼저 볼 수 있다.                    | High     | Verified |
| FR-003 | Persist analysis          | As a 운영 담당자, I want 검토한 분석을 저장하고 다시 조회하기 so that 같은 정의로 작업을 계속할 수 있다. | High     | Verified |

| FR-004 | Reuse saved metric | As a 운영 담당자, I want AI가 저장 지표를 참조할 때 검증된 계산식을 사용하기 so that 질문에 따라 계산 기준이 달라지지 않는다. | High | Verified |

| FR-005 | Update metric calculation | As a 운영 담당자, I want 저장 지표 계산식을 바꾸고 선택한 기존 분석에 검토 후 반영하기 so that 같은 계산 기준으로 계속 분석한다. | High | Verified |

| FR-006 | Batch metric update | As a 운영 담당자, I want 같은 지표를 쓰는 분석을 확인하고 선택하여 일괄 변경하기 so that 계산 기준을 함께 유지한다. | High | Verified |

| FR-007 | Prompt lifecycle | As a 운영 담당자, I want 한 대화에서 대시보드 생성·수정·저장·게시하기 so that 제작 업무를 하나의 흐름으로 끝낸다. | High | Open |
| FR-008 | Semantic creation | As a 운영 담당자, I want 소스에서 지표·차원을 제안받아 만들고 재사용하기 so that SQL 없이 계산 기준을 유지한다. | High | Open |
| FR-009 | Block editing | As a 운영 담당자, I want 블록 추가·삭제·복제·이동·크기 조절과 AI 수정을 함께 사용하기 so that 원하는 구성을 직접 만든다. UC-016은 명시한 여러 블록을 전체 미리보기 후 원자 저장하고 부분 실패 때 전체 무변경으로 복구한다. UC-017은 저장 충돌·결과 불명확·AI 취소 후 초안을 보존하고 상태 확인 후 재시도한다. UC-032는 같은 로그인/탭에서 생성 저장 확인 기록을 복구해 명시 재확인한다. UC-031은 Studio 생성 저장 응답 유실 후 같은 요청으로 비공개 결과를 확인한다. UC-030은 갱신 일시 장애와 잠금 보유 탭 종료 후 살아 있는 탭의 초안 보존/재시도를 다룬다. UC-029는 지원 브라우저에서 같은 origin의 동시 갱신을 조정한다. UC-028은 다른 탭의 정상 토큰 갱신 후 같은 로그인 세션의 보관 초안 복구를 지원한다. UC-027은 최신 조회 실패·저장 재충돌 후 재시도를 다룬다. UC-025·UC-026은 같은 로그인 세션·탭에서 새로고침 후 초안·질문을 명시 복구한다. UC-046은 Studio 보관 초안과 다른 탭의 최신 변경을 비교하고 충돌 항목을 명시 선택해 병합한다. UC-047은 저장 응답 유실 후 새로고침에서 같은 요청을 명시 재확인하고 현재 저장본으로 복귀한다. | High | In Progress |
| FR-010 | Responsive editing | As a 운영 담당자, I want 모바일과 데스크톱에서 같은 결과물을 편집하기 so that 기기 전환 후 작업을 이어간다. | High | Open |
| FR-011 | Publish versions | As a 운영 담당자, I want 저장과 게시를 구별하고 링크 공유·재게시·공유 중지를 실행하기 so that 의도한 버전과 범위만 전달한다. UC-018은 전체 기간 고정 집계의 명시 링크 게시·재게시·중지와 저장 분리를 다룬다. | High | In Progress |
| FR-012 | Remix with source mapping | As a 공유 수신자, I want 허용된 대시보드를 복제하고 내 데이터로 재사용하기 so that 원본을 바꾸지 않고 새 분석을 만든다. | High | Open |

### Enterprise Data Artifact 확장

| ID | Title | User Story | Priority | Status |
|---|---|---|---|---|
| FR-013 | Organization scope | As a 조직 관리자, I want 구성원과 역할별 Artifact 접근 범위를 설정하기 so that 조직 경계 밖에 기업 결과물이 노출되지 않는다. | High | Open |
| FR-014 | Business semantics | As a 운영 담당자, I want 생성 전 결과를 바꾸는 업무 기준을 확인하기 so that 통화·분모·날짜 의미가 맞는 Artifact를 만든다. | High | Open |
| FR-015 | Execution evidence | As a 운영 담당자, I want 블록의 실행 근거를 확인하기 so that 소스·지표 버전과 조건에 따라 숫자를 설명할 수 있다. | High | Open |
| FR-016 | Refresh lifecycle | As a 데이터 관리자, I want 데이터 갱신 상태와 실패 복구를 관리하기 so that 마지막 정상 버전을 유지하며 Artifact를 반복 사용한다. | High | Open |
| FR-017 | Schema impact | As a 운영 담당자, I want 소스 스키마 변경의 영향 블록을 확인하기 so that 깨진 계산을 정상 결과로 오해하지 않는다. | High | Open |
| FR-018 | Data access policy | As a 데이터 관리자, I want 소스·행·열 접근 정책을 모든 조회 경로에 적용하기 so that 상세·내보내기·AI 호출로 권한을 우회할 수 없다. | High | Open |
| FR-019 | LLM disclosure policy | As a 조직 관리자, I want LLM에 전달할 데이터 범위를 제한하기 so that 허용된 제공자와 문맥만 기업 분석에 사용한다. | High | Open |
| FR-020 | Publication data contract | As a 공유 수신자, I want 게시본의 데이터 모드·기준 시점·조회 범위를 확인하기 so that 고정 결과와 최신 데이터 조회를 구별한다. | High | Open |
| FR-021 | Safe Artifact reuse | As a 공유 수신자, I want 허용된 Artifact 정의를 내 소스로 재사용하기 so that 원본 데이터 권한과 비밀을 복사하지 않고 새 결과를 만든다. | High | Open |
| FR-022 | Evidence based narrative | As a 운영 담당자, I want AI 설명의 수치·주장에 실행 근거를 연결하기 so that 관측 사실과 원인 가설을 구별한다. | High | Open |
| FR-023 | Narrative block | As a 운영 담당자, I want 설명을 독립 Block으로 편집하기 so that 차트·표와 함께 분석 보고서를 구성한다. | Medium | Open |
| FR-024 | Filter block | As a 운영 담당자, I want 필터를 명시적인 Block으로 구성하기 so that 적용 대상과 저장·게시 조건을 이해한다. | Medium | Open |
| FR-025 | Validated source relation | As a 데이터 관리자, I want 소스 결합의 키와 카디널리티를 검증하기 so that 중복 조인으로 금액이 부풀지 않는다. | Medium | Open |
| FR-026 | Aggregate condition | As a 운영 담당자, I want 차원별 집계 결과에 조건을 적용하기 so that 환불률이 높은 채널 같은 업무 대상을 찾는다. | Medium | Open |
| FR-027 | Scheduled refresh | As a 데이터 관리자, I want 승인된 소스의 갱신을 예약하기 so that 매번 수동 수집하지 않고 같은 Artifact를 유지한다. | Medium | Open |
| FR-028 | Audit history | As a 조직 관리자, I want Artifact 변경과 데이터·AI 접근의 감사 기록을 조회하기 so that 실행자·대상·결과를 추적한다. | High | Open |

## Non-Functional Requirements

| ID      | Title               | Requirement                                                                                                                                                                                                                                                                                                                           | Category    | Priority | Status      |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ----------- |
| NFR-001 | Layout              | 390px·1440px 폭에서 변경 패널 가로 넘침 0px. UI-001 전환 후 [공통 UI Kit](design/analysis-ui-kit.md)의 일반 버튼36px·도구줄 sm32px·입력36px·본문14px를 기준으로 역할별 variant/size를 적용한다. 긴 문구·여러 줄 입력은 높이가 늘어날 수 있다. 실제 검증 화면·상태만 증빙하며 이전 MUI 치수의 Verified를 새 UI 전체에 승계하지 않는다. | Usability   | High     | In Progress |
| NFR-002 | Numeric consistency | 동일 조건의 KPI 값과 시계열 버킷은 서버 결과를 사용하며 표시 정밀도를 유지하고 부동소수점 집계의 상대 허용 오차1e-9 안에서 일치한다.                                                                                                                                                                                                  | Reliability | High     | Verified    |

| NFR-003 | Cross viewport state |390/768/1440px 편집·조회에서 가로 넘침0px, 선택·미저장 정의·undo 상태 보존, 비대상 블록 ID/배치 동일을 TC-005로 확인한다. | Usability | High | Open |
| NFR-004 | Operation integrity | 재시도 시 중복 저장·게시·복제0개, revision 충돌 시 비의도 변경0개, 게시 실패 시 성공한 초안 저장 보존을 TC-005로 확인한다. | Reliability | High | In Progress |

### Enterprise Data Artifact 품질 목표

| ID | Title | Requirement | Category | Priority | Status |
|---|---|---|---|---|---|
| NFR-005 | Access isolation | EA-08/10의 비인가 소스·행·열·캐시·내보내기·AI 경로에서 금지 데이터 반환0건, 권한 확대0건을 서버/API와 실제 화면으로 확인한다. | Security | High | Open |
| NFR-006 | Minimal LLM disclosure | 초기 정책의 원본 예시 행 전송 기본값0행, 비밀/금지 열 전송0건. EA-09에서 제공자 직전 전송 문맥을 검사하고 정책 거절 시 제공자 호출0건을 확인한다. | Security | High | Open |
| NFR-007 | Evidence completeness | 성공한 게시 블록100%에서 소스 버전·지표 버전·조회 조건·데이터 시점·실행 상태를 추적한다. 설명의 수치 주장100%는 해당 블록/실행 근거로 연결하며 내부 SQL을 수신자에게 공개할 필요는 없다. | Reliability | High | Open |
| NFR-008 | Refresh integrity | EA-05/06의 실패·중단·재시도에서 기존 성공 버전 손실0건, 중복 활성 버전0건, 명시 재게시 전 고정 게시본 변경0건을 확인한다. | Reliability | High | Open |
| NFR-009 | Pilot interaction budget | 하드웨어·파일 해시·기간·캐시 상태를 기록한139만 행 기준, 동시 사용자1명/동시 요청1개에서 준비5회 후 측정30회 필터 집계 응답p95≤2초를 목표로 한다. LLM 응답·수입은 제외하고 별도 측정하며 미달 시 측정값과 제한을 공개한다. | Performance | Medium | Open |
| NFR-010 | First user completion | 동일 업무의 첫 담당자3명 중2명 이상이 준비된 소스로 질문→미리보기→비공개 저장을10분 이내·진행자 도움1회 이하로 완료하는 것을 목표로 한다. 독립 정답 일치와 각 수용/보류를 기록하며 에이전트 실행은 집계하지 않는다. | Usability | High | Open |

## Constraints

| ID    | Title                | Constraint                                                                                                                                              | Category  | Priority | Status   |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | -------- |
| C-001 | Structured internals | 데이터 소스·지표 정의·분석 화면의 책임을 구분한다. 내부 구조를 사용자 파일 트리로 노출하지 않는다. 이번 작업은 기존 저장 정의와 DuckDB 실행을 유지한다. | Technical | High     | Verified |
| C-002 | Existing runtime     | 기존 실행 환경·데이터·로그인을 유지하고 Codex gpt-6-luna를 사용한다. 자동 모델 대체와 새 의존성은 추가하지 않는다.                                      | Technical | High     | Verified |

| C-003 | Product direction | 작업은 UC-005 생성·블록 편집·게시·재사용 여정 또는 그 정확성/권한/UI 회귀에 직접 연결한다. Rill 기능 복제와 외부 엔진은 독립 완료 목표로 삼지 않는다. | Product | High | Open |

### Enterprise Data Artifact 경계

| ID | Title | Constraint | Category | Priority | Status |
|---|---|---|---|---|---|
| C-004 | Structured Artifact | 초기 Artifact는 기존 Studio/Dashboard·구조화 Block·지표 컴파일러를 재사용한다. 임의 생성 JS/HTML·LLM SQL을 실행하는 범용 호스팅은 도입하지 않는다. | Technical | High | Open |
| C-005 | Minimal operations | 초기 분석 저장은 기존 메타데이터 DB와 단일 Node/DuckDB worker·영속 볼륨을 유지한다. 별도 큐/분산 엔진은 측정된 필요 없이 선행 도입하지 않으며 다중 replica 파일 쓰기를 지원한다고 주장하지 않는다. | Operational | High | Open |
| C-006 | Enterprise release boundary | 조직의 LLM 전송 정책·공유 정책을 만족하기 전 기업 원본의 외부 전송/공유를 허용하지 않는다. 다중 조직 서비스는 EA-08의 조직 격리를 포함한 수용 후 공개한다. | Business | High | Open |
