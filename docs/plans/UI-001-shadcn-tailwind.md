# UI-001: 전체 UI를 shadcn + Tailwind로 전환

사용자 승인: 2026-10-15, 기존 감사 보고서의 전환 순서를 바탕으로 전체 UI 전환과 Ego 실제 화면 검증을 요청했다.

## 목표와 보존 계약

제품 목표 P1~P5의 생성/수정/저장/복제/게시 여정에서 같은 의미의 컨트롤과 상태를 같은 shadcn 컴포넌트와 Tailwind 토큰으로 구성한다. MUI/Emotion 기반 UI 및 테마/sx를 제거한다. 데이터 엔진, SQL/숫자, API payload, atomic 저장/재시도, 공유 권한, 블록 ID와 폭별 배치/undo-redo는 보존한다. ECharts/Ace/react-grid-layout은 전문 엔진이며 주변 제어 UI와 시각 토큰을 통일한다. 새로운 일반 UI 프레임워크나 MUI 호환 계층은 만들지 않는다.

## 실행

1. 기준 SHA e8f657fd에서 별도 워크트리/브랜치를 사용한다. 변경 전 기존 전체 FE 단위 테스트를 기록한다.
2. Node24, 기존 npm lockfile로 별도 의존성을 설치한다. 공식 shadcn CLI/Radix 및 Tailwind Vite plugin을 설치하고 의미 토큰/공통 field/notice를 구성한다. Pretendard는 유지한다.
3. 독립 작업: Dashboard/Assistant; Explore/Data/Commerce; 공통 components; shell/auth/share/widget; landing. 각 담당은 실제 shadcn API와 Tailwind로 전환하며 공통 기반 파일은 리더가 소유한다.
4. 통합하며 MUI/Emotion/sx/styled/CSS selector 잔여와 타입 오류를 해소한다. 테스트 mock으로만 통과시키지 않고 기존 동작 assertion과 실제 UI를 검증한다.
5. 전체 FE 단위/타입/린트/빌드, 루트 빌드/단위, 핵심 격리 E2E를 실행한다. 외부 원본 DB/서버를 변경하지 않는 임시 DB와 별도 포트를 사용한다.
6. Ego TaskSpace 8을 재사용해 로그인, 주요 화면/폼/모달/탐색, 생성-편집-저장-새로고침-공유 대표 여정과 390/768/1440 폭을 확인한다. 캡처와 실제 숫자/저장 검증을 분리하고 기능/디자인 결과를 기록한다.

## 디자인 기준

shadcn Radix 기반, 중립 surface/border/muted와 primary accent, Pretendard. 레이아웃/간격/상태는 Tailwind 의미 토큰과 공통 variants를 사용한다. 일반 컨트롤 높이32/36px, 분석 컨트롤28px를 역할별 variant로 표현한다. 디바이스 폭별 wrap/overflow와 키보드 포커스/모달 포커스 복원을 확인한다. 기존 기능을 숨기거나 단순화해서 전환 완료로 판정하지 않는다.

## 종료 조건

활성 앱/랜딩 UI에 MUI/Emotion/Bootstrap 의존 및 sx/styled 디자인이 없고, 실제 shadcn 소스와 Tailwind 빌드가 사용된다. 해당 회귀 검사가 통과하고 Ego 실제 화면 증거를 남긴다. 미실행/환경 block은 명시하며 전체 완료로 확대하지 않는다. 자동 승인 거절은 우회하지 않는다.

## 완료 기록 — 2026-10-15

로컬 전환과 대표 여정 검증을 완료했다. 공식 shadcn/Radix + Tailwind로 활성 앱·랜딩과 공통 UI를 전환하고 MUI/Emotion/Bootstrap 및 sx/styled를 제거했다. FE880개/핵심 E2E8개, 타입/빌드/lockfile 설치를 확인했으며 lint는 error0/warning22다. Ego390/768/1440 실제 화면, gpt-6-luna 생성·저장·편집 보존·공유 중지를 확인했다. BE 기존 실패1개와 미실행 범위는 [최종 검증 기록](../testing/shadcn-tailwind-migration.md)에 분리했다. 배포·제품 전체 수용 완료를 포함하지 않는다.
