# Studio AI 생성 진입 통일

Status: Draft · P2/P3 · TC-005 생성 진입 지원 · PASS_SELECTED.

## 공백과 변경

홈 시작 카드의 ‘질문으로 대시보드 만들기’는 Studio를 열지만 목록 추가 메뉴의 ‘AI 대시보드 만들기’는 이전 AI 패널을 열었다. 목록 메뉴도 `/studio/new`로 이동하도록 수정했다. `aiSourceId` 직접 링크의 기존 패널과 저장 후 게시 준비 이동은 유지한다. 생성 엔진·게시·복제 계약은 변경하지 않는다.

## 실제 화면 · 2026-10-17

Ego83, 기존 FE3698/API4899 프록시 환경에서 확인했다. 목록 메뉴 → Studio 진입 후 기존 공개 합성 source32(37행/8열) 선택 → 질문 입력을 수행했다. 홈 시작 카드도 같은 URL을 연다. 진입/소스 선택 XHR은 sources·metrics·profile GET200 총3건이며 POST0이다. 질문 전송·새 저장·게시·새 샘플 설치는 수행하지 않았다.

기능 **PASS_SELECTED**: 두 진입점 모두 Studio를 열며 데이터 선택·질문 입력이 가능하다. 질문→생성→저장 전체 여정의 새 실행을 의미하지 않는다. 해당 엔진의 기존 증빙은 [생성 대화 연결](creation-composer.md)의 검증 범위를 따른다.

디자인 **PASS_SELECTED**: 메뉴 열린 상태와 소스/질문 상태의390/768/1440px 각각 캡처·DOM 측정·시각 확인. 문서 가로 넘침0, 생성 화면 주요 버튼36px/보조32px, 모바일 select/textarea16px. 기존 표 내부 가로 스크롤은 유지하며 문서 넘침과 구분한다. 메뉴는 기존 DropdownMenu 배치/폰트/높이를 유지한다. 실휴대폰·전체 접근성·새 Rill 비교는 NOT_RUN이며 이번 변경은 차트 화면에 영향을 주지 않는다.

## 검사와 증빙

- 관련 FE2파일20개 PASS: AI 메뉴의 실제 pathname/search, 수동/추천 생성 경로, 소스 지정 링크, 기존 저장→게시 이동 및 홈 카드 회귀.
- FE 타입/변경 lint PASS. AIWF pin/check 일치. strict는 기존12 errors/33 warnings/4 infos로 실패 상태를 유지하며 새 진입 변경을 전체 명세 승인으로 보고하지 않는다. 전체 build/core E2E는 단순 메뉴 이동 변경이라 재실행하지 않았다. 기존 전체 여정 PASS를 이번 변경의 새 결과로 합산하지 않는다.
- 증빙: `/tmp/vm-uc040/`의 `menu-{390,768,1440}.png/json`, `source-question-{390,768,1440}.png/json`, `entry-xhr.json`, `source-question-xhr.json`, `card-entry.json`, `unit.log`, `type.log`, `lint.log`.
- 초기 도구 호출의 이름 없는 role locator는 Ego 문법 오류로 중단됐다. 같은 공간에서 지원되는 CSS select로 복구했다. 제품 오류/통과로 집계하지 않는다.
- 전체 TC-005 제품 수용·운영·실기기 gate는 유지한다.
