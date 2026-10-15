# UC-021 공유·게시 대시보드 재사용 검증

2026-10-16(KST), `0887922a` 위 변경. P5/FR012, [UC](../use_cases/UC-021-reuse-shared-dashboard.md)·[설계](../architecture/shared-dashboard-reuse.md)·[TC](../test_cases/TC-021-reuse-shared-dashboard.md)를 먼저 작성했다. 별도 native executor가 권한 리뷰, 게시/migration/recipe, 소유자 UI, SQLite 검사로 분담했고 Main이 통합·실제 화면을 검증했다. Draft·awaiting_review·acceptance not_recorded이며 운영 배포/전체 P5 수용은 별도다.

## 구현 / 권한

소유자가 명시적으로 켠 링크만 로그인 수신자가 **내 소스로 복제 → 열 연결 → 전체 미리보기 → 복사본 저장**할 수 있다. 기존 링크는 기본 불허다. 일반 공유는 현재 저장 정의, 게시는 게시 미리보기 ticket에 캡처한 고정 정의를 사용한다. 게시 뒤 원본 수정은 게시 recipe를 바꾸지 않는다. 새 복사본은 수신자의 소스·새 dashboard/block ID·비공개이며 모든 화면 폭 배치를 보존한다. 원본 지표 링크/공유/게시/접근 권한은 가져오지 않는다.

재사용 API는 필요 열 이름/타입과 내 소스만 제공하며 원본 소스 ID·SQL·결과·인증을 반환하지 않는다. preview도 표시 필드만 투영한다. 저장된 내 복사본은 새 소스 SQL을 편집/조회할 수 있으므로, **계산식·필터 조건·배치가 복사본에 포함됨**을 소유자 UI에 명시했다. 비밀 필터를 숨긴 채 편집 가능한 복제를 제공한다는 계약은 아니다.

기존 live 공유는 위젯 결과 조회용 제한 shareToken을 유지한다. 공유 메타데이터에서 analysisDefinition/structuredDefinition을 제거했다. 로그인 수신자가 live 공유를 볼 때 본인 인증이 먼저 적용돼 위젯이403을 받던 문제는 `/share`·`/embed`의 GET `/database/data`에만 제한 토큰을 쓰도록 수정했다. 나머지 소스/재사용 API는 본인 인증을 사용한다. 토큰 설치도 위젯 마운트보다 먼저 수행한다.

게시 nullable private `reuseDefinition`과 공유 `allowReuse=false`·`reuseVersion=0` migration을 추가했다. 게시/공유 중지·만료·grant 변경·재게시·현재 공유본 변경은 미저장 ticket을 무효화한다. SQLite 쓰기 queue/metadata transaction의 전후 guard와 생성 영수증을 재사용한다. 이미 저장된 복사본/동일 요청 영수증은 원본 링크 중지 후에도 유지된다. 원본 조회 때 토큰이 갱신돼도 ticket을 무효화하지 않도록 shareToken은 버전 hash에서 제외했다.

## 자동 검사

| 검사                                   | 결과 / 범위                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 관련 BE 6 suites                       | 71 PASS: 게시·recipe·migration·공유 원자 저장·소유 복제·기존 공유 회귀를 포함한다.                                                                     |
| 최종 helper 변경 delta                 | 3 suites32 PASS. COUNT(\*)처럼 필요 열이0개인 recipe도 연결/재연결 가능하며 알 수 없는 열은 거절.                                                      |
| BE 전체                                | 96 suites / 1,667 tests PASS (Node24). 이후 COUNT(\*) helper의 좁은 변경은 위32개와 Nest build로 추가 검증.                                            |
| FE 관련 최종                           | 6 files54 PASS: 재사용/게시/ShareButton·인증 회귀·공유 hook. 별도 안전한 로그인 복귀 helper6개도 통과.                                                 |
| FE 전체                                | 67 files / 1,006 tests PASS, `npm test -- --maxWorkers=4` (Node24). 최초 기본 병렬 실행은 기존 대형 테스트7개가5초 timeout; 제한 재실행에서 모두 통과. |
| FE 타입 / 변경 ESLint / BE 변경 ESLint | 타입 PASS, 최종 변경 lint 오류0. 기존 unused 경고(BE2/FE2)는 유지.                                                                                     |
| 루트 build / 최종 BE build             | Nest/Vite PASS. 로컬 실제 API는 기존 Node22.23.1 유지.                                                                                                 |
| AIWF strict lint                       | 기존12 errors/34 warnings/4 info. 새 UC021 진단 없음. pin/check는 내용 drift 증거이며 승인 아님.                                                       |

SQLite 검사는 실제 엔티티·원자 저장기·권한·origin resolver를 사용하고 집계 preview/소스 profile은 테스트 대역이다. 별도 Ego 실행은 실제 DuckDB 파일/API를 사용했다. MySQL migration/잠금·운영 DB·전체 Playwright 핵심 E2E는 NOT_RUN이다.

## Ego 실제 기능 / XHR

TaskSpace43. 소유자 `127.0.0.1:3698`, 별도 수신자 `localhost:3698`, API4899→4898, 기존 로컬 SQLite/DuckDB 환경. 토큰은 브라우저에서만 사용하고 증빙에 저장하지 않았다.

- 공개 Rill 파생 분석23을 소유자가 UI에서 공유·재사용 허용했다. 게시는 기본 불허 게시의 reusable=false를 확인한 뒤 체크→미리보기→명시 재게시해 허용했다.
- 수신자 계정 `vmreuse1016`에 공식 Rill 파일2,000행의 요청 수를 추가3배로 바꾸고 열을 `my_requests/my_floor/my_count/my_os`로 바꾼 소스27을 업로드했다. 소스 목록에는 수신자 소스26/27만 있었고 원본23은 없었다. 첫 화면 소스는 미선택이며 자동 원본 profile 요청이 없다.
- 일반 공유와 게시 링크 각각에서 실제 클릭/선택으로4개 열 연결→POST preview201→POST save201→새로고침했다. **공유 복사본25, 게시 복사본26**이 생성됐다. 요청 수 **5,330,400**, 평균 **3.5034561451116626**, 두 숫자 카드의 시간별 추세25점과 OS 차트가 새 파일 DuckDB oracle과 일치했다. 원본 형식에 따라 화면 요청 수는5M, 평균$3.50이다.
- 저장된 두 복사본은 source27·새 block ID·동일 mobile/tablet/desktop 좌표·publication=null이다. 원본23의 editor/analysis 응답은 작업 전후 완전히 동일하다. 게시/공유 설정만 의도적으로 임시 변경했다.
- 수신자 원본 소스/profile·원본 editor·grant 조회는 각각403, 익명 재사용은401이다. 공유 메타데이터 응답에 analysisDefinition/structuredDefinition이 없다. 재사용 미리보기 응답에는 SQL이 없다.
- 테스트 계정만 로그아웃해 게시 링크→로그인 안내→실제 로그인→같은 재사용 URL 복귀·소스 미선택을 확인했다. Bitwarden 자동완성 팝업은 Escape 후 Enter로 제출했다.
- 마지막에 게시·live 공유를 중지하고 grant=false로 복원했다. 공유/게시 재사용 및 익명 게시 결과는404, 내 복사본 editor는200이다. 중지 후 같은 게시 복제 저장 요청은201 `{id:26,replayed:true}`이며 새 복사본을 만들지 않는다. 복사본25/26·소스26/27과 수신자 검증 계정은 로컬 검토용으로 보존했다.

## 디자인 / 비교

390/768/1440px의 공유·게시 복제 미리보기와 저장 화면, 390px 소유자 공유/게시 설정을 캡처·실측했다. 복제 페이지 주요 버튼/입력36px, 새 진입/저장 화면 주요 버튼32px, 모바일 입력16px·데스크톱14px를 사용한다. 라벨/입력·동일 행의 높이, 세로 쌓기·줄바꿈, 설정 설명과 비활성 버튼을 확인했고 최종 대표 화면 가로 넘침0이다. 숫자와 추세가 함께 보이며 원본 논리 배치의 빈 공간도 그대로 보존한다. 기능 PASS와 대표 디자인 PASS를 구분한다. 모든 폭의 모든 로딩/오류·실휴대폰/터치는 미검증이다.

Rill9009의 숫자+추세·OS 분포를 참조한다. 교체 파일은 전체 데모와 행/배율이 달라 같은 수치라고 주장하지 않는다. 새로운 결과의 계산 정답은 같은 파생 파일·같은 SQL DuckDB oracle로 검증했다. Rill에서 수신자 remix 자체를 재현하거나 같은 bucket의 전체 수치 대조를 한 것은 아니다.

## 증거와 남은 범위

`/tmp/vm-shared-reuse/`의 original-before/after, share/publication-preview-events, publication-saved-events, copy-reloaded, oracle, permission-statuses, login-return, revoked-and-replay, summary, 폭별 PNG/실측·검사 로그. 임시 파일의 영구 보존은 보장하지 않는다. `.aiwf/evidence/UC-021`에는 요약과 검사 로그를 보존한다.

처음 토큰을 파일에 저장하려던 검증 명령은 자동 승인 검토에서 거절됐다. 토큰 파일을 만들지 않고 브라우저 세션을 사용하는 안전한 방식으로 모든 해당 검증을 수행했다. 추가 공개 권한을 요청하거나 기존 사용자 데이터를 삭제하지 않았다.

운영 MySQL·실기기·임의 SQL/외부 엔진·커머스 데이터 의미·게시 링크의 모든 오류/응답 유실 실제 주입·전체 TC005/P5 수용은 후속이다. 새 복사본 저장 후 AI 편집→재게시의 통합 제품 여정도 이 검증만으로 완료 처리하지 않는다.
