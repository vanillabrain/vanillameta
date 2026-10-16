# UC028 다른 탭 토큰 갱신 후 초안 복구 검증 — 2026-10-16

[UC028](../use_cases/UC-028-cross-tab-token-draft.md)·[설계](../architecture/cross-tab-token-draft.md)·[계획](../plans/UC-028.md)·[TC028](../test_cases/TC-028-cross-tab-token-draft.md)·[리뷰](../architecture/UC-028-review.md). 기준 develop-v2 `9e1fb03b`+이번 변경, 최종 원격 Studio 전용 `ca8305ae`를 보존했다. Ego68 하나·기존 FE3698/API4899→4898/SQLite·공개 Rill 복사본35/source30을 사용했다. 증빙은 `/tmp/vm-uc028/`, 제품 코드를 고정한 마지막 UI 여정은 `final/`이다.

## 구현과 세션 경계

AIWF UC/설계/계획/TC를 먼저 작성했다. 탭별 tokenHash 별칭만 있던 editorDraftStorage에 같은 origin의 공유 메타데이터(로그인 세대 UUID·현재 SHA256 tokenHash·안정된 scope)를 추가했다. 초안 본문은 sessionStorage에 유지한다. 정상 refresh만 승계하고 기존 authHelper의 setToken/removeToken이 부르는 clearEditorDrafts에서 세대를 교체한다. authHelper 자체의 호출 계약은 바꾸지 않았다. 다른 탭 본문을 직접 지우지는 않으나 새 로그인에서 예전 scope를 찾아 연결하지 않는다. 같은 문자열 토큰 재로그인도 분리한다.

API interceptor는 refresh 전 토큰·세대를 캡처하고 성공 전후 재검사한다. 늦은 성공/실패는 다른 탭의 새 인증을 덮거나 로그아웃시키지 않는다. helper는 expectedEpoch를 확인하고 해시 대기 동안의 세대 변경도 거절한다. 기존 초안 별칭은 공유 상태가 없던 첫 바인딩의 같은 tokenHash일 때만 승계한다. 공유 저장 오류는 인증 갱신 자체를 실패시키지 않지만 초안 보관·복구 보장을 하지 않는다. 새 서버 API/DB/의존성/LLM은 추가하지 않았다.

Main 검토에서 갱신 연결 기록 직후의 낡은 key 계산이 공유 hash를 덮을 수 있는 짧은 경합도 발견해, 다른 hash에 이미 바인딩된 상태는 덮지 않고 거절하도록 보완했다. 해시 계산 후 세대/hash/기존 accessToken 저장 문자열이 바뀌면 key를 발급하지 않는다. 기존 토큰 저장소의 원문을 비교만 하며 새로운 공유 필드에 원 토큰·SQL·질문·행·preview를 기록하지 않는다.

## 최종 Ego 두 탭 여정

1. 화면과 API 호스트를 `127.0.0.1`로 맞춘 정상 로그인 세션에서 첫 탭 제목 “UC028 · 세션 갱신 복구 최종”과 질문 “다른 탭의 정상 토큰 갱신 후에도 이 최종 질문과 초안을 유지해 줘.”를 보관했다. 둘째 탭은 본문 보관0이다.
2. 저장소 밖 임시 프록시는 정확한 GET `/v1/user/userinfo`에 만료401을1회 반환했다. `final/injections.jsonl`1건이며 refresh·재요청은 실제 서버로 전달했다. 둘째 탭 UI reload에서 XHR401→실제 `/user/get-access-token`201→userinfo200을 확인했다. JWT 실제 만료 시각을 기다린 것은 아니다. 원 토큰/쿠키는 로그에 출력하지 않고 상태·해시만 저장했다.
3. `final/auth-before/after`에서 tokenHash는 달라지고 epoch/scope는 같았다. 공유 메타데이터 키는 epoch/tokenHash/scope뿐이고 둘째 탭 본문0을 유지했다. `first-tab-stale-alias`의 첫 탭 별칭은 아직 이전 tokenHash, 공유 별칭은 새 tokenHash였다. 저장 이벤트 수신에 의존하지 않는다.
4. 첫 탭 실제 reload→권한 GET200→보관 초안 복구 제안을 확인했다. 같은 원래 key·본문·질문이 남고 서버 쓰기는0이었다. **보관한 초안 복구**로 제목·질문을 복원했고 저장은 새 미리보기 전 비활성이었다. 자동 AI 요청은0, 실제 LLM 질문은 이번 여정에서 실행하지 않았다.
5. 전체 미리보기201→명시 저장201을1회 수행했다. 최종 items 전체와 sourceId는 시작과 동일하고 대시보드 제목만 바뀌었다. SQL/차트/표시/ID/모든 폭 배치·비대상 최신 OS 제목을 유지했다. 성공 후 기능 보관 key0·편집기 재진입 질문 빈값·복구 안내 없음이다.
6. 검증 프록시를 정상 `/tmp/vm-rill-views/proxy.cjs`로 복원하고 같은 저장 revision의 게시 결과 미리보기201→명시 링크 게시201로 버전17을 만들었다. 숫자1,269,026,000·169점 추세 시간/값·OS28그룹 값이 미리보기와 공개 snapshot에서 일치했다. 공개·게시 관리·저장 화면을 실제 reload해 추가 저장·게시0을 확인했다. `/ai/dashboard-preview` POST는 읽기 계산이다.
7. 임시 링크를 중지해 최종18/inactive·인증 헤더 없는 공개 GET404를 확인했다. 수정 복사본35는 비공개로 보존한다. 모든 fault remaining0·정상 프록시 실행을 확인했다.

`final/assertions.py/json`은 갱신 hash와 같은 세대/scope·첫 탭 이전 별칭·복구 본문·저장1회·보존·정리·수치·추가쓰기0·게시17/중지18을 비교한다. 공개 탭은 로그인 세션이라 익명 브라우저 세션 검증으로 표기하지 않는다. 원본27에는 쓰기 요청을 보내지 않았고 전체 원본 재조회는 이번 범위가 아니다. Rill 수치 oracle은 TC005/UC025 증빙을 재사용했고 이번에 Rill 화면을 새로 실행하지 않았다.

## 기능과 디자인

기능 PASS_SELECTED_VARIANTS / 대표 디자인 PASS. 최종 복구 제안·복구 미리보기·게시 준비·공개 화면은390/768/1440 CSS폭에서 가로 넘침0이다.127 origin에서는768을 정확히 실측했다. 기존36px 일반 컨트롤/입력·32px 도구·14px 본문·12px 보조를 유지했고 복구 버튼 wrapping·주변 정렬을 실제 캡처로 확인했다. 전역 크기 override나 새 설정 UI는 추가하지 않았다.

`final/recovery-offer-*`, `restored-preview-390.png`, `publication-preview-390.png`, `public-active-*`, `public-full-390.png`를 남겼다. 기존 사용자 배치의 세로 공백과 OS/숫자 순서를 보존했고 전체 페이지에서 숫자+시계열을 확인했다.

## 자동 검사·리뷰

최종 인증 코드·원격 Studio 후속 통합 직전 FE90파일1290개 PASS(`full-fe-final3.log`, maxWorkers2)·type(`type-final3.log`)·build(`build-final2.log`) PASS. 변경 lint 오류0/기존 apiHelper 미사용 경고2다. 핵심 격리8개 PASS(`core-final2.log`, `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-wSFoPT/evidence/playwright-001.log`).

helper19/auth17/editor88 관련124개는 전체 suite 안에 포함된다. 두 독립 sessionStorage 모델과 공유 localStorage로 두 번 갱신/이벤트 미수신·새로그인/동일토큰/로그아웃 분리·해시 대기 중 세대 교체·낡은 hash의 공유 별칭 덮어쓰기 거절·기존 별칭 초기 승계·이전 세대 expectedEpoch 거절·공유 저장 실패의 인증 성공 보존·늦은 refresh 성공/실패의 새 로그인 보존을 확인했다. 다중 탭 동시 refresh 전역 single-flight를 구현했다고 주장하지 않는다.

별도 code-reviewer 요청은 제공자400으로 실행되지 않았다. Main이 구현 후 별도 diff/명세 대조로 비동기 경계·권한 조회 선행·세대 분리·본문 비공유·성공 정리와 실패 결과를 검토했다. 독립 리뷰/사람 승인으로 표기하지 않는다. 문서는 Draft, packet awaiting_review/acceptance not_recorded다. AIWF strict 기존12오류/33경고/4정보는 남기고 기준선을 수용하지 않았다.

## 실패 기록과 범위

초기 localhost 화면/API127 조합의 실제 refresh 시도는 로그인으로 이동해 실패했다. 쿠키 SameSite=Lax 설정과 호스트 불일치를 확인하고 같은 Ego68에서127로 정렬·검증 소유 계정으로 표준 로그인한 후 재실행했다. 초기401/로그인 이동은 정상 갱신 PASS로 집계하지 않는다. 기존127 검증 계정이 남아 로그인 입력 대기가 실패했고, 계정 메뉴/확인 다이얼로그로 정상 로그아웃·소유자 로그인을 수행했다.

첫 같은 호스트 여정은 저장/게시15·중지16까지 갔지만 helper 수정에 따른 Vite 자동 reload가 첫 탭 별칭 기록에 섞여 있었다. root assertion은 이전 별칭을 요구해 실패했다. 이를 기대값을 완화해 통과시키지 않고 제품 코드를 고정해 `final/`에서 갱신→이전 별칭→명시 reload/복구→저장/게시17/중지18 전체를 다시 검증했다. 최종 assertion의 버전 치환이169를189로 바꾼 도구 오타는 원래169로 바로잡아 통과했다.

초기 단위1실패는 Date.now가 다른 새 fixture 전체를 비교한 테스트 오류여서 보존 질문 비교로 고쳤다. 최초 수정 명령의 cwd 오류도 올바른 파일 경로로 고쳤다. 최종 회귀 추가 후 타입 검사에서 테스트의 Uint8Array spread가 기존 TS target과 맞지 않아 Array.from으로 수정했다. 병렬 core/build 중 전체 FE의 기존 SourceDetails2건이5000ms timeout을 기록해 보존했고, 다른 검증이 종료된 후 maxWorkers2로 전체1290을 통과했다. 테스트 제한시간이나 기대 동작을 늘려 우회하지 않았다. 격리core 최초 포트 바인딩 EPERM은 승인된 로컬 포트 실행으로 재시도해8개를 확인했다.

실휴대폰·다중 탭 동시 갱신 전체 조합·모든 오류/스토리지·브라우저 종료/다른 기기 복구·운영DB·전체제품 수용은 미확인이다. 호스트가 다른 환경의 refresh 쿠키 구성 해결도 이번 제품 변경 범위 밖이다.

## 최종 원격 통합

push 전 원격 `ca8305ae`의 Studio 생성 제안 만료 저장 차단과 회귀1개를 fast-forward로 보존했다. 의존성/인증/이번 UI 경로와 겹치지 않는 국소 변경이다. 통합 후 helper/auth/editor+Studio 생성4파일130개·type/build PASS(`integrated-targeted/type/build.log`). 통합 후 전체1291개를 실행했다고 합산하지 않는다. 기존 전체1290·core8은 같은 최종 인증 코드의 증거이며 원격 Studio 추가는 관련 회귀로 확인했다.
