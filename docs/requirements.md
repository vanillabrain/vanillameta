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

| FR-013 | Artifact discovery | As a 운영 담당자, I want 허용된 저장 산출물을 제목·유형으로 찾고 정렬하기 so that 사내 결과물을 다시 열어 활용한다. | High | Open |
| FR-007 | Prompt lifecycle | As a 운영 담당자, I want 한 대화에서 대시보드 생성·수정·저장·게시하기 so that 제작 업무를 하나의 흐름으로 끝낸다. | High | Open |
| FR-008 | Semantic creation | As a 운영 담당자, I want 소스에서 지표·차원을 제안받아 만들고 재사용하기 so that SQL 없이 계산 기준을 유지한다. | High | Open |
| FR-009 | Block editing | As a 운영 담당자, I want 블록 추가·삭제·복제·이동·크기 조절과 AI 수정을 함께 사용하기 so that 원하는 구성을 직접 만든다. UC-016은 명시한 여러 블록을 전체 미리보기 후 원자 저장하고 부분 실패 때 전체 무변경으로 복구한다. UC-017은 저장 충돌·결과 불명확·AI 취소 후 초안을 보존하고 상태 확인 후 재시도한다. UC-032는 같은 로그인/탭에서 생성 저장 확인 기록을 복구해 명시 재확인한다. UC-031은 Studio 생성 저장 응답 유실 후 같은 요청으로 비공개 결과를 확인한다. UC-030은 갱신 일시 장애와 잠금 보유 탭 종료 후 살아 있는 탭의 초안 보존/재시도를 다룬다. UC-029는 지원 브라우저에서 같은 origin의 동시 갱신을 조정한다. UC-028은 다른 탭의 정상 토큰 갱신 후 같은 로그인 세션의 보관 초안 복구를 지원한다. UC-027은 최신 조회 실패·저장 재충돌 후 재시도를 다룬다. UC-025·UC-026은 같은 로그인 세션·탭에서 새로고침 후 초안·질문을 명시 복구한다. UC-046은 Studio 보관 초안과 다른 탭의 최신 변경을 비교하고 충돌 항목을 명시 선택해 병합한다. UC-047은 저장 응답 유실 후 새로고침에서 같은 요청을 명시 재확인하고 현재 저장본으로 복귀한다. | High | In Progress |
| FR-010 | Responsive editing | As a 운영 담당자, I want 모바일과 데스크톱에서 같은 결과물을 편집하기 so that 기기 전환 후 작업을 이어간다. | High | Open |
| FR-011 | Publish versions | As a 운영 담당자, I want 저장과 게시를 구별하고 링크 공유·재게시·공유 중지를 실행하기 so that 의도한 버전과 범위만 전달한다. UC-018은 전체 기간 고정 집계의 명시 링크 게시·재게시·중지와 저장 분리를 다룬다. | High | In Progress |
| FR-012 | Remix with source mapping | As a 공유 수신자, I want 허용된 대시보드를 복제하고 내 데이터로 재사용하기 so that 원본을 바꾸지 않고 새 분석을 만든다. | High | Open |

### Enterprise analysis requirements

사내 분석·공유를 위한 신규 요건이다. [기업용 설계](architecture/enterprise-analysis.md)를 따른다. 각 Open은 미완료 요구이며 구현·수용 완료가 아니다. MK AI 연동 계약은 현재 제외한다.

| ID     | Title                           | User Story                                                                                                                                           | Priority | Status |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-014 | Analysis catalog                | As a 관리자, I want 허용된 분석 소스의 표시명·설명·활성 상태·이용 범위를 관리 so that 직원이 승인된 데이터로 분석한다.                               | High     | Open   |
| FR-015 | Business variable definitions   | As a 데이터 담당자, I want 열의 업무 표시명·수치/범주/날짜 유형·날짜 형식·단위와 공통 분류를 관리 so that AI와 직접 편집이 같은 의미를 사용한다.     | High     | Open   |
| FR-016 | Employee lifecycle              | As a 관리자, I want 업무계정·소속 조직/팀·활성 상태를 검색하고 관리 so that 입사·이동·퇴사에 따른 접근을 통제한다.                                   | High     | Open   |
| FR-017 | Resource access policies        | As a 관리자, I want 데이터와 산출물의 열람·편집·게시·내보내기 권한을 각각 부여·회수 so that 공유와 데이터 접근을 독립적으로 통제한다.                | High     | Open   |
| FR-018 | Visual condition groups         | As a 분석 담당자, I want 유형별 연산자로 중첩 AND·OR 조건을 구성·저장·복원 so that SQL 없이 반복 분석 기준을 유지한다.                               | High     | Open   |
| FR-019 | Profile and population preview  | As a 분석 담당자, I want 허용된 분포·샘플과 전체/조건충족/제외후 건수·비율을 확인 so that 현재 조건의 범위와 데이터 특성을 이해한다.                 | High     | Open   |
| FR-020 | Validated AI change proposals   | As a 분석 담당자, I want AI 설명·조회·변경 제안을 구분하고 유효한 변경 차이를 검토 so that 알 수 없는 열이나 지표가 분석에 섞이지 않는다.            | High     | Open   |
| FR-021 | Recipient distribution controls | As a 산출물 소유자, I want 직원/그룹에게 조회 접근 또는 독립 복사를 구별해 전달하고 공유 관계를 관리 so that 원본과 수신자 작업을 보존한다.          | High     | Open   |
| FR-022 | Personal notifications          | As a 수신자, I want 공유·권한·내보내기 이벤트를 본인 알림함에서 확인·읽음·목록 제거 so that 전달받은 작업을 찾아 이어간다.                           | High     | Open   |
| FR-023 | Durable export jobs             | As a 분석 담당자, I want 검토한 조건의 결과 내보내기를 요청하고 작업 상태·파일 만료를 확인 so that 화면과 같은 기준의 결과를 후속 업무에 사용한다.   | High     | Open   |
| FR-024 | Archive and dependency checks   | As a 산출물 소유자, I want 개인 보관·자산 비활성화·삭제를 구분하고 영향받는 사용처를 확인 so that 불필요한 목록을 정리하면서 연결된 업무를 보호한다. | High     | Open   |
| FR-025 | Comparable period reports       | As a 분석 담당자, I want 기준·비교 기간과 분류별 수치·추이를 같은 조건으로 조회 so that 조회와 출력의 기준 차이 없이 업무 보고를 만든다.             | High     | Open   |

## Non-Functional Requirements

| ID      | Title               | Requirement                                                                                                                                                                                                                                                                                                                           | Category    | Priority | Status      |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ----------- |
| NFR-001 | Layout              | 390px·1440px 폭에서 변경 패널 가로 넘침 0px. UI-001 전환 후 [공통 UI Kit](design/analysis-ui-kit.md)의 일반 버튼36px·도구줄 sm32px·입력36px·본문14px를 기준으로 역할별 variant/size를 적용한다. 긴 문구·여러 줄 입력은 높이가 늘어날 수 있다. 실제 검증 화면·상태만 증빙하며 이전 MUI 치수의 Verified를 새 UI 전체에 승계하지 않는다. | Usability   | High     | In Progress |
| NFR-002 | Numeric consistency | 동일 조건의 KPI 값과 시계열 버킷은 서버 결과를 사용하며 표시 정밀도를 유지하고 부동소수점 집계의 상대 허용 오차1e-9 안에서 일치한다.                                                                                                                                                                                                  | Reliability | High     | Verified    |

| NFR-003 | Cross viewport state |390/768/1440px 편집·조회에서 가로 넘침0px, 선택·미저장 정의·undo 상태 보존, 비대상 블록 ID/배치 동일을 TC-005로 확인한다. | Usability | High | Open |
| NFR-004 | Operation integrity | 재시도 시 중복 저장·게시·복제0개, revision 충돌 시 비의도 변경0개, 게시 실패 시 성공한 초안 저장 보존을 TC-005로 확인한다. | Reliability | High | In Progress |

| NFR-005 | Consistent server authorization | TC050에서 목록·상세·미리보기·변경·공유·작업·파일 받기를 역할별로 검사한다. 권한 회수 후 다음 보호 요청의 비허용 데이터 응답/새 작업 생성은0건이며 UI 숨김만으로 통과하지 않는다. 이미 전달된 파일의 원격 회수는 보장하지 않는다. | Security | High | Open |
| NFR-006 | Query and export fidelity | 동일 조건/소스 버전/지표 버전/시간대의 미리보기·집계·내보내기가 독립 정답과 일치한다. 제외 조건과 샘플/전체 범위를 구별하고 기준이 달라졌으면 이전 결과를 현재값으로 표시하지 않는다. | Reliability | High | Open |
| NFR-007 | Attributable business events | 공유·권한·정의/버전·비활성화·내보내기 요청/결과에 행위자·자원ID·기준버전·시각·결과를 남기고 비밀/원본 행을 기록하지 않는다. 보존 기간과 감사 열람 정책은 운영 도입 전에 합의하며 임의1년 보장을 하지 않는다. | Maintainability | High | Open |
| NFR-008 | Recoverable job state | TC050에서 중복 요청은 같은 사용자/동일 본문에 작업1개, 알림 장애는 성공한 본 저장 취소0개다. 재시작 중 미확정 작업은 중단/결과확인 상태를 제공하고 완료/파일 성공으로 추정하지 않는다. | Reliability | High | Open |

## Constraints

| ID    | Title                | Constraint                                                                                                                                              | Category  | Priority | Status   |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | -------- |
| C-001 | Structured internals | 데이터 소스·지표 정의·분석 화면의 책임을 구분한다. 내부 구조를 사용자 파일 트리로 노출하지 않는다. 이번 작업은 기존 저장 정의와 DuckDB 실행을 유지한다. | Technical | High     | Verified |
| C-002 | Existing runtime     | 기존 실행 환경·데이터·로그인을 유지하고 Codex gpt-6-luna를 사용한다. 자동 모델 대체와 새 의존성은 추가하지 않는다.                                      | Technical | High     | Verified |

| C-003 | Product direction | 작업은 UC-005 생성·블록 편집·게시·재사용 여정 또는 그 정확성/권한/UI 회귀에 직접 연결한다. Rill 기능 복제와 외부 엔진은 독립 완료 목표로 삼지 않는다. | Product | High | Open |

## 사내 분석 요건 추적

신규 FR014~025/NFR005~008은 [사내 설계](architecture/enterprise-analysis.md), [TC050](test_cases/TC-050-enterprise-analysis.md)에 연결한다. 기존 ID/완료 상태/제품 런타임은 변경하지 않는다.
