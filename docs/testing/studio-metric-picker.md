# UC050 Studio 저장 지표 탐색과 계산 기준 확인

## 범위

2026-10-18, 비교 기준 `fc6c88af`. FR015·BR050-01/02·[계획](../plans/UC-050.md)의 기존 지표 재사용 선택기 개선이다. 기존 소유/활성 지표 GET `/bi/metrics` 응답을 사용하며 새 BE/API/DB 스키마/의존성은 없다. 구조화 정의를 조회·표시하는 범위이며 새 계산/LLM 실행·저장/게시·공식 승인을 추가하지 않는다.

`StudioCreate`의 기존 체크 목록을 `StudioMetricPicker`로 옮겼다. 이름과 ID/정의 버전으로 동명이름을 구분한다. 기본 검색은 접혀 있고, 펼친 입력은 이름·표시 #ID·집계·대상/분모/가중치 열·단위를 NFKC/소문자/앞뒤 공백 정규화 부분검색한다. 검색과 선택 수를 별도로 표시하며 선택 지표는 검색 불일치에도 유지한다. 접으면 전체 목록을 복원한다. 검색/접기/계산 기준 상세보기는 부모 질문·생성안·저장 준비나 체크 선택을 바꾸지 않는다. 실제 체크 변경만 기존 invalidate와 selectedMetricIds 전달을 유지한다. 소스가 바뀌면 key로 선택기 검색 상태를 초기화한다.

접힌 native details에는 definition의 aggregation/column/denominatorColumn/weightColumn/scale/unit만 표시한다. 비율의 분모와 가중 평균의 가중치 이름을 구별하고 단위 없음은 미지정, 집계 기준 없음은 미확인으로 안내한다. 수식/SQL을 생성·실행하거나 의미를 추론하지 않는다. 이 화면은 저장 당시 필드의 참고 표시이며 필수 열/수치 정답/현재 정의 유효성 검증은 종전 서버 제안·미리보기 경계가 담당한다. 임의 SQL/연결정보/비대상 정의 필드는 렌더하지 않는다.

## 검증 범위

로컬 로그 `/tmp/vm-metric-picker/`, Git 제외 `.aiwf/evidence/UC050-metric-picker/`에 보존한다. 컴포넌트 미존재 red를 확인한 뒤 구현했고, 초기 테스트 matcher 환경/Unicode 검색 fixture 중복과 TS 낮은 target의 Set spread 문제를 수정했다.

- 신규 선택기: 동명이름/ID·버전·선택 상태, 비율/가중치·배율·단위, 미확인/단위 미지정, SQL/연결정보 미표시, 정규화/#ID/열/단위 검색·검색0건 선택 유지/접기 복원, 체크만 콜백, busy 선택/검색 잠금을 확인한다.
- StudioCreate 실제 컴포넌트 회귀: 체크→제안 요청 selectedMetricIds=[9]→계산 미리보기500→검색0건에도 선택/질문·미리보기·명시 저장 버튼 보존/추가GET·POST0→체크 해제 시 미리보기 폐기/질문 보존을 확인한다. 서버 실행이 아니라 fixture 응답 기반이다.
- 기존 Studio 생성·대화 생성·소스 검색/업무 설명·재사용 선택 회귀와 FE type/lint/build를 실행한다. BE 변경이 없어 이전 검증을 재실행하지 않으며 운영MySQL/실제 권한·LLM/저장을 새로 통과시켰다고 주장하지 않는다.

선택 FE99개(6파일)·type/lint/build가 통과했다. 상세보기 직접 펼침의 콜백0과 소스 변경의 검색 초기화/선택 해제도 회귀 범위다. strict 문서 검사는 오류0·기존 FR011/NFR002 상태 경고2로 exit1이다. pin/check가 일치하고 packet은 awaiting_review/acceptance not_recorded다. 별도 code-reviewer는 APPROVE와 medium1건(기존 2열/스크롤 제한 소실)을 보고했다. 기존 studio-create-metric-options 클래스를 복원해 넓은 폭2열/599px이하1열·max-height264px 내부 스크롤 규칙을 재사용하고 목록 region의 키보드 포커스를 추가했다. 실제 viewport 실측 완료로 확대하지 않는다. 공개 대상11파일의 식별 문구0·비공개 경로0과 diff 공백 검사도 확인했다. 이 작업은 새 엔티티/상태/시퀀스 계약을 추가하지 않아 entity model·요구사항 상태/전체 TC050 상태는 변경하지 않는다.

## 디자인과 실제 화면 경계

공통 입력36px/도구32px·본문14px/보조12px 토큰을 사용하고 체크 라벨과 상세는 별도 조작이다. 기존2열→599px이하1열/264px 목록 내부 스크롤·긴 라벨 줄바꿈·fieldset min-width와 포커스 가능한 목록/native summary 키보드 경로를 유지한다. 실제 Ego는 이전 사용자 제어권 반환을 확인하지 않아 재탈취/새 공간 우회 없이 BLOCKED/NOT_RUN이다.390/768/1440 실측·긴 이름/로딩·포커스/모바일 터치와 Rill 화면 비교는 미실행이며 디자인 PASS로 보고하지 않는다. 조직별 역할·공식 승인/전체 카탈로그·운영/실휴대폰/고객 수용은 미완료다.
