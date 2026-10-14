# Requirements

## Functional Requirements

| ID     | Title                     | User Story                                                                                               | Priority | Status   |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------- | -------- | -------- |
| FR-001 | Consistent metric preview | As a 운영 담당자, I want 숫자 지표와 시계열을 함께 미리보기 so that 저장 결과를 예측할 수 있다.          | High     | Verified |
| FR-002 | Progressive settings      | As a 운영 담당자, I want 보조 설정을 필요할 때 펼치기 so that 결과를 먼저 볼 수 있다.                    | High     | Verified |
| FR-003 | Persist analysis          | As a 운영 담당자, I want 검토한 분석을 저장하고 다시 조회하기 so that 같은 정의로 작업을 계속할 수 있다. | High     | Verified |

## Non-Functional Requirements

| ID      | Title               | Requirement                                                                                                                                               | Category    | Priority | Status   |
| ------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | -------- |
| NFR-001 | Layout              | 390px·1440px 폭에서 변경 패널 가로 넘침 0px, 일반 버튼28px·선택 입력32px·글꼴12px를 공통 UI Kit로 적용한다. 긴 문구·여러 줄 입력은 높이가 늘어날 수 있다. | Usability   | High     | Verified |
| NFR-002 | Numeric consistency | 동일 조건의 KPI 값과 시계열 버킷은 서버 결과를 사용하며 표시 정밀도를 유지하고 부동소수점 집계의 상대 허용 오차1e-9 안에서 일치한다.                      | Reliability | High     | Verified |

## Constraints

| ID    | Title                | Constraint                                                                                                                                              | Category  | Priority | Status   |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | -------- |
| C-001 | Structured internals | 데이터 소스·지표 정의·분석 화면의 책임을 구분한다. 내부 구조를 사용자 파일 트리로 노출하지 않는다. 이번 작업은 기존 저장 정의와 DuckDB 실행을 유지한다. | Technical | High     | Verified |
| C-002 | Existing runtime     | 기존 실행 환경·데이터·로그인을 유지하고 Codex gpt-6-luna를 사용한다. 자동 모델 대체와 새 의존성은 추가하지 않는다.                                      | Technical | High     | Verified |
