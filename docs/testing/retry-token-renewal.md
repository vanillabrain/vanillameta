# UC030 갱신 장애·잠금 보유 탭 종료 복구 — 2026-10-16

기준 develop-v2 `9c2229b7`+이번 변경. [UC030](../use_cases/UC-030-retry-token-renewal.md)·[설계](../architecture/retry-token-renewal.md)·[계획](../plans/UC-030.md)·[TC030](../test_cases/TC-030-retry-token-renewal.md)·[리뷰](../architecture/UC-030-review.md). 저장소 밖 증빙 `/tmp/vm-uc030/`, Ego70 단일 공간, 기존 FE3698/API4899→4898/SQLite, 공개 Rill 복사본35/source30을 사용했다.

## 설계·수정·회귀

AIWF 문서를 먼저 작성하고 별도 명세 대조·strict/pin을 수행했다. 기존 refresh 실패 catch가 모든 오류에 removeToken을 호출해503/네트워크 오류도 인증 세대와 복구 scope를 정리하는 문제가 있었다. 회귀6개를 추가해503/통신/timeout/잘못된201응답의4개 실패를 먼저 재현했다(`red.log`,25PASS/4FAIL). catch의 인증 거절을401/403으로 좁혀 일시 장애는 요청 실패로 전달하면서 기존 인증·초안을 보존한다. 기존 요청 세대·승자 토큰 재사용·finally/잠금 해제는 유지한다. 실제 인증 성공으로 우회하거나 자동 저장/게시·무한 재시도하지 않는다.

기존 generic refresh-denied 테스트는 실제 인증 거절401 오류로 명시했다. 401/403 정리·로그인 이동, 일시 실패 뒤 같은 scope로 명시 재시도를 검증한다. 영구 entity/glossary/저장소·서버·DB·의존성·UI 토큰을 변경하지 않았다. 브라우저 소유 잠금 해제는 [Web Locks 표준](https://www.w3.org/TR/web-locks/#termination-of-locks)을 참고했다.

## Ego 실제 실행

1. 기존 세션/DB를 유지했다. 최초 진입 URL `/bi/35`는404여서 실제 router의 `/dashboard/35/edit-charts`를 확인해 같은 공간에서 진입했다. 테스트 프록시를 임시 셸 백그라운드로 띄운 두 시도는 셸 종료 뒤 유지되지 않아 편집 조회 오류가 발생했다. 독립 프로세스로 재연결하고 화면의 최신 내용 다시 불러오기를 실행했다. 초안 생성 전의 환경 오류이며 제품 장애나 데이터 손실로 집계하지 않는다.
2. 첫 탭 제목 “UC030 · 갱신 장애에도 보존한 초안”, 질문 “갱신 장애와 탭 종료 뒤에도 내 질문과 초안을 보존해 줘.”를 입력했다. preview XHR에만 테스트 표식 `?uc030=1`을 붙였다. `/bi/dashboards/35/editor/preview?uc030=1`에만 만료401 1회, 이어진 refresh POST에503 1회를 테스트 프록시에서 반환했다. JWT 실제 만료 대기를 수행한 것은 아니다.
3. 실제 XHR401/refresh503, 로그인 세대/hash/scope 불변·token 존재·초안/base/revision/질문 보존을 확인했다. 서버 저장/게시0이다. UI는 내부503문자열 대신 기존 “미리보기를 불러오지 못했습니다. 편집 내용은 유지됩니다. 미리보기를 다시 시도해 주세요.”를 표시한다. 원시 오류 문구/textarea를 찾던 검증 대기는 실제 UI 컨트롤과 달라 시간 초과됐고 snapshot으로 버튼/입력을 다시 확인했다. 기능 실패로 오인하지 않았다.
4. 실제 reload→권한 GET→“보관한 초안 복구”를 클릭했다. 같은 제목/질문/base/정의가 복구되고 이전 preview는 자동 재실행되지 않았다. 명시 preview에 만료401을1회 더 주입한 뒤 실제 서버 refresh201→preview201·저장 활성화를 확인했다. 자동 background retry가 아니다.
5. 같은 공간의 작업 소유 둘째 탭p2에 별도 제목/질문을 만들었다. 두 표식 preview에401을1회씩 주입하고 실제 첫 refresh201응답만 잠시 보류했다. 둘째 탭의 preview를 먼저 클릭해 보유자로 만들고 첫 탭을 대기시켰다. 브라우저 `navigator.locks.query()`에서 held1/pending1을 기록한 같은 호출에서 p2를 닫고 응답 보류를 명시 해제했다. 첫 탭이 잠금을 이어받아 실제 refresh→preview201로 성공했다. 잠금은 최종held0/pending0, 첫 탭의 초안/질문/base 불변이다.
6. 종료 변형에서는 서버 refresh가 두 번 처리됐다(닫힌 탭의 응답 유실1회+살아 있는 탭1회). 단일 갱신 성공으로 집계하지 않는다. 최초503과 명시재시도까지 합해 프록시 로그는 표식401총4회·refresh요청4회·실패503한건·서버201세건이다.201은 전부 명시 release이며8초 안전 deadline 도달은 없었다. 이미 서버에서 처리한 갱신을 rollback했다고 주장하지 않는다. 닫힌 탭 초안 복구도 보장하지 않는다.
7. 정확한 테스트 프록시 프로세스만 종료하고 기존 정상4899프록시를 복원한 뒤 살아 있는 탭의 preview를 저장201 한 번→게시 preview201→명시 링크 게시21로 연결했다. 원본27에는 쓰지 않았다. 저장35의 SQL/ID/블록 순서·모든 폭 배치·소스·표시·기존 비대상 OS 제목을 유지하고 대시보드 제목만 바뀌었다.
8. 게시 snapshot은 숫자1,269,026,000·169시간점·OS28그룹을 유지했다. 공개/게시관리/저장 화면의 실제 reload와 추가 저장/게시0, 편집기 재진입 시 질문빈값·보관초안0을 확인했다. 공개 탭은 로그인된 origin이므로 익명 브라우저 세션으로 표기하지 않는다. 링크는 최종22/inactive·인증헤더/쿠키 없는 GET404로 중지했다. 정상 서버는 유지한다.

`before/after-failure`, `auth-*`, `restored-after-failure`, `retry-*`, `holder/survivor-*`, `locks-*`, `proxy-events.jsonl`, `saved/reloaded`, `publication-*`, `*-reload-audit`, `assertions.py/json`이 근거다. 실제 LLM을 호출하지 않았고 질문 보존+직접 preview를 확인했다. Rill canonical 수치는 TC005/UC025 기존 증거를 재사용하며 Rill 화면 새 비교는 이번 범위가 아니다.

## 디자인·자동 검사

기능 PASS_SELECTED_VARIANTS / 대표 디자인 PASS. 오류상태·복구후편집/게시미리보기·게시결과를 캡처했다. 오류상태와 게시결과390/768/1440 CSS폭 넘침0, 모바일 복구편집/게시미리보기390px 넘침0을 확인했다. 일반/입력36px·도구32px 및 기존14/12px 글꼴을 유지했다. 오류 문구 줄바꿈과 질문/제목/날짜·게시 컨트롤 크기·정렬을 실제390/1440 캡처로 검토했다. 기존 사용자 블록 좌표에 따른 큰 세로 공백·순서는 보존하며 레이아웃 개선으로 보고하지 않는다. 새 UI/CSS는 없다.

- 관련 회귀48PASS(auth29/helper19). 루트 전체 BE116파일2045개·FE90파일1306개 PASS(`root-test.log`).
- FE type·변경lint 오류0/기존 미사용 경고2·루트BE/FE build PASS(`type/lint/build.log`).
- 격리 핵심8PASS(`core.log`, `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-6Ks7mp/evidence/playwright-001.log`)·Ego 증빙 assertion PASS_SELECTED_VARIANTS.

Main의 작성 후 별도 코드/명세 대조이며 독립 리뷰나 사람 승인이 아니다. 문서 Draft·packet awaiting_review/acceptance not_recorded를 유지한다. AIWF strict는 기존12오류/33경고/4정보이며 기준선을 수용하지 않는다. pin/check는 일치 증거이고 사람 수용이 아니다.

## 미확인

실휴대폰·전체 오프라인/repeated503·응답유실 뒤 refresh cookie rotation의 모든 서버 구성·닫힌 탭 복원·잠금 미지원 전역단일화·운영DB/전체 제품 수용은 미확인이다. 시간초과/네트워크/잘못된응답과 인증거절은 단위 회귀이며 실제 화면은503+잠금보유탭종료 변형이다.
