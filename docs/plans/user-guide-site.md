# 사용자 가이드 사이트 설계

2026-10-21 · develop `b406b9e3` 기준. 사용자 요청: Rill을 참고한 상세 가이드를 문서 도구로 제공한다. 기존 가이드 실제 화면 검증의 후속이며 제품 기능을 추가하거나 외부에 배포하는 작업은 아니다.

## 도구 결정

| 도구       | 장점                                                        | 이번 적용 판단                                             |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| VitePress  | Markdown 중심, 기본 문서 탐색과 브라우저 내 검색, 정적 배포 | 기존 Markdown·Vite 사용 저장소에 적합해 선택               |
| Docusaurus | React 기반, 버전별 문서·국제화 등의 구성                    | 다중 릴리스 문서 운영 시 재검토할 수 있으나 현재 필수 아님 |

공식 참고: [VitePress 소개](https://vitepress.dev/guide/what-is-vitepress), [검색](https://vitepress.dev/reference/default-theme-search), [Docusaurus 소개](https://docusaurus.io/docs). VitePress 2 문서는 alpha 표시이므로 npm에서 확인한 안정 1.6.4를 정확 버전으로 고정한다. 검색은 외부 서비스 계정이 필요 없는 local 방식이다. 기본 전이 Vite 5 의존성의 audit 3건(고위험 1 포함)을 확인하여 독립 패키지에 Vite 6.4.4 override를 고정했다. 재설치 audit 0건이며 빌드·개발/미리보기 호환성을 별도 확인한다. VitePress의 공식 기본 의존 범위를 넘는 override이므로 도구 업그레이드 때 유지 필요성을 재검토한다.

## Rill을 참고하는 범위

[Rill Explore 안내](https://docs.rilldata.com/guide/dashboards/explore)의 빠른 시작·화면 읽기·지표/차원·시간·필터·비교·기능별 심화 구조를 참고한다. Rill 문장·이미지를 복제하거나 기능 동등성을 주장하지 않는다. VanillaMeta 고유 질문→미리보기→저장→게시·재사용을 중심으로 재구성한다.

## 문서·제품 영향

- UC050~055의 사용 흐름, 기존 AI Studio 사용자 가이드를 기능별 페이지로 연결한다. 요건·정책·UC ID는 바꾸지 않는다.
- 소스: `docs/user-manual/site/`만 사이트·검색에 포함한다. 내부 `docs/plans`, `docs/testing`, 비공개 자료는 소스 범위 밖이다.
- 기존 빠른 시작과 캡처 모음은 VitePress include로 재사용한다. 링크만 Markdown 처리 단계에서 사이트 경로로 조정한다. 원문을 이중 유지하지 않는다.
- `site/`의 기능별 상세 가이드가 심화 안내의 기준이다. 기존 통합 매뉴얼은 GitHub에서 읽는 개요로 유지한다.
- 기존 공개 합성 데이터 캡처 16장을 직접 참조한다. 이미지와 문서 내용 이외의 자료·원본을 수집하지 않는다.
- 도구는 독립 package/lock으로 격리하고 root docs:dev/build/preview를 제공한다. 제품 의존성·화면·API는 변경하지 않는다.
- 사용자 문서의 상태는 실제 제품 실행/소스 대조/이번 사이트 실행을 구분한다. 전체 수용·운영 검증을 추정하지 않는다.

## 정보 구조

시작(빠른 시작/개념/이동), 데이터·지표·Explore·Pivot, AI 생성·수정·질문 예시·복구, 게시·조직·재사용·출력/보관, 문제 해결·캡처·지원 범위. 각 안내는 목적·조건·순서·결과와 제한을 포함한다.

## 검증과 완료 조건

1. 설치/production build 성공, 링크 오류를 무시하지 않는다.
2. 루트 및 하위 경로 base에서 사이트 경로가 일관되게 생성된다.
3. Ego에서 페이지 이동·한국어 검색 결과 열기·메뉴·목차·이미지 로딩·새로고침을 확인한다.
4. 390/768/1440px의 페이지 넘침·글자·컨트롤 크기/정렬을 측정하고 실제 캡처를 검토한다.
5. 내부 설계/검증 문서가 HTML·검색 자산에 들어가지 않았는지 확인한다.
6. 실행 기록을 남기고 변경 파일만 commit/push한다. 외부 호스팅 배포는 별도다.

공개 캡처는 predev/prebuild에서만 `.vitepress/public/images/`에 준비한다(생성물 Git 제외). 개발 서버의 VitePress 기본 workspace fs.allow 병합도 configResolved에서 문서 패키지로 제한한다. 로컬 검증 기록은 [실행 증빙](../testing/user-guide-site.md), 문서 변경 자동 build/링크 검사는 `.github/workflows/user-guide.yml`을 따른다. 원격 CI 성공이나 배포 완료를 로컬 결과로 대신하지 않는다.
