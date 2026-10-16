# Requirements

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
| FR-009 | Block editing | As a 운영 담당자, I want 블록 추가·삭제·복제·이동·크기 조절과 AI 수정을 함께 사용하기 so that 원하는 구성을 직접 만든다. UC-016은 명시한 여러 블록을 전체 미리보기 후 원자 저장하고 부분 실패 때 전체 무변경으로 복구한다. UC-017은 저장 충돌·결과 불명확·AI 취소 후 초안을 보존하고 상태 확인 후 재시도한다. UC-025는 같은 로그인 세션·탭에서 새로고침 후 초안·질문을 명시 복구한다. | High | In Progress |
| FR-010 | Responsive editing | As a 운영 담당자, I want 모바일과 데스크톱에서 같은 결과물을 편집하기 so that 기기 전환 후 작업을 이어간다. | High | Open |
| FR-011 | Publish versions | As a 운영 담당자, I want 저장과 게시를 구별하고 링크 공유·재게시·공유 중지를 실행하기 so that 의도한 버전과 범위만 전달한다. UC-018은 전체 기간 고정 집계의 명시 링크 게시·재게시·중지와 저장 분리를 다룬다. | High | In Progress |
| FR-012 | Remix with source mapping | As a 공유 수신자, I want 허용된 대시보드를 복제하고 내 데이터로 재사용하기 so that 원본을 바꾸지 않고 새 분석을 만든다. | High | Open |

## Non-Functional Requirements

| ID      | Title               | Requirement                                                                                                                                                                                                                                                                                                                           | Category    | Priority | Status      |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ----------- |
| NFR-001 | Layout              | 390px·1440px 폭에서 변경 패널 가로 넘침 0px. UI-001 전환 후 [공통 UI Kit](design/analysis-ui-kit.md)의 일반 버튼36px·도구줄 sm32px·입력36px·본문14px를 기준으로 역할별 variant/size를 적용한다. 긴 문구·여러 줄 입력은 높이가 늘어날 수 있다. 실제 검증 화면·상태만 증빙하며 이전 MUI 치수의 Verified를 새 UI 전체에 승계하지 않는다. | Usability   | High     | In Progress |
| NFR-002 | Numeric consistency | 동일 조건의 KPI 값과 시계열 버킷은 서버 결과를 사용하며 표시 정밀도를 유지하고 부동소수점 집계의 상대 허용 오차1e-9 안에서 일치한다.                                                                                                                                                                                                  | Reliability | High     | Verified    |

| NFR-003 | Cross viewport state |390/768/1440px 편집·조회에서 가로 넘침0px, 선택·미저장 정의·undo 상태 보존, 비대상 블록 ID/배치 동일을 TC-005로 확인한다. | Usability | High | Open |
| NFR-004 | Operation integrity | 재시도 시 중복 저장·게시·복제0개, revision 충돌 시 비의도 변경0개, 게시 실패 시 성공한 초안 저장 보존을 TC-005로 확인한다. | Reliability | High | In Progress |

## Constraints

| ID    | Title                | Constraint                                                                                                                                              | Category  | Priority | Status   |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | -------- |
| C-001 | Structured internals | 데이터 소스·지표 정의·분석 화면의 책임을 구분한다. 내부 구조를 사용자 파일 트리로 노출하지 않는다. 이번 작업은 기존 저장 정의와 DuckDB 실행을 유지한다. | Technical | High     | Verified |
| C-002 | Existing runtime     | 기존 실행 환경·데이터·로그인을 유지하고 Codex gpt-6-luna를 사용한다. 자동 모델 대체와 새 의존성은 추가하지 않는다.                                      | Technical | High     | Verified |

| C-003 | Product direction | 작업은 UC-005 생성·블록 편집·게시·재사용 여정 또는 그 정확성/권한/UI 회귀에 직접 연결한다. Rill 기능 복제와 외부 엔진은 독립 완료 목표로 삼지 않는다. | Product | High | Open |
