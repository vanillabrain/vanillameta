# UC029 두 탭 동시 인증 갱신·초안 복구 검증 — 2026-10-16

[UC029](../use_cases/UC-029-concurrent-token-renewal.md)·[설계](../architecture/concurrent-token-renewal.md)·[계획](../plans/UC-029.md)·[TC029](../test_cases/TC-029-concurrent-token-renewal.md)·[리뷰](../architecture/UC-029-review.md). 기준 develop-v2 `974caa55`+이번 변경, 원격 Studio 후속 `7d2b520e`는 최종 통합 항목으로 구분한다. Ego69 하나·기존 FE3698/API4899→4898/SQLite·공개 Rill 복사본35/source30을 사용했다. 저장소 밖 증빙은 `/tmp/vm-uc029/`다.

## 설계·구현

UC028에서 남긴 동시 갱신 조정을 선택해 UC/설계/계획/TC를 먼저 작성했다. apiHelper의 user 인증 헤더 설정 때 원 요청 세대를 기록하고, 만료 후 같은 세대만 처리한다. 같은 origin Web Locks가 있으면 배타 잠금 안에서 기존 refresh→scope승계→토큰저장을 수행한다. 기다린 탭이나 늦게 도착한401은 같은 세대의 새 토큰이 있으면 추가 refresh 없이 재사용한다. 새 로그인 세대면 이전 요청을 거절하고 새 인증은 지우지 않는다.

탭 내부 refreshPromise는 유지한다. 잠금 대기10초 만료/획득 실패는 실제 refresh를 시작하지 않았으므로 초안·인증을 지우지 않는다. 잠금 오류를 무시하고 무잠금 실행으로 우회하지 않는다. Web Locks 미지원은 기존 탭 내부 경로이며 전역1회를 보장하지 않는다. callback 진입 때 대기 타이머를 해제하고 실제 네트워크는 기존10초 timeout을 따른다. 서버·DB·의존성·본문 저장소·UI 토큰은 바꾸지 않았다. 일시 요청 세대는 영구 엔티티가 아니므로 entity/glossary는 기존 UC028 모델을 유지한다.

[W3C Web Locks](https://www.w3.org/TR/web-locks/)의 같은 origin 배타 잠금/callback 후 release를 참고했다. Ego의 secure context=true·navigator.locks.request 지원을 실제 확인했다.

## 실제 Ego 두 탭 경합

1. 재개 시 FE3698/API4898이 내려가 있고 기존4899 프록시만 남아 있었다. 새 TaskSpace 생성 후 최초 goto가 연결 거절돼 listTaskSpaces에서 같은69를 찾아 재개했다. 새 공간으로 우회하지 않았다. 기존 DB/업로드/설정을 사용하는 API와 FE를 재실행했다. 데이터 초기화·새 seed는 하지 않았다.
2. 각 탭에 같은 대시보드의 다른 초안을 보관했다. 첫 탭 제목 “UC029 · 동시 갱신 뒤 첫 탭 초안”/질문 “동시 토큰 갱신 뒤에도 첫 탭의 질문과 초안을 보존해 줘.”, 둘째 제목 “UC029 · 독립된 둘째 탭 초안”/질문 “동시 토큰 갱신 뒤에도 둘째 탭의 다른 질문을 보존해 줘.”다. sessionStorage의 같은 기능 key라도 각 탭 본문은 다르다.
3. 테스트용 XHR 관찰자가 이 두 탭의 preview POST에만 `?uc029=1` 표식을 붙였다. 임시 로컬 프록시는 정확한 `/v1/bi/dashboards/35/editor/preview?uc029=1` 두 요청에 만료401을1회씩 반환하고 첫 실제 서버 refresh 응답만 잠시 보류했다. 제품 코드에 fault switch를 추가하지 않았다. JWT 실제 시간 만료를 기다린 것으로 표기하지 않는다.
4. 첫 탭의 미리보기 버튼 클릭 후 둘째 탭 버튼을 클릭했다. `navigator.locks.query()`에서 `vm:auth-refresh:v1` held1/pending1을 확인했다. 이를 기록한 같은 Ego 호출 안에서 프록시 응답 보류를 해제했다. `proxy-events.jsonl`은 만료401두건·실제 refresh request한건·정상201응답/explicit release한건이다. 보류는8초 안전 한도가 있지만 이번에는 약0.7초 내 명시 해제로 끝났다.
5. 두 탭 모두 원 preview 요청이201로 성공했고 둘째 탭은 refresh를 추가로 호출하지 않았다. 이번 원 요청은 읽기용 preview POST여서 성공 코드는200이 아니라201이다. 양쪽 tokenHash는 갱신됐고 epoch/scope·각 초안/질문/기준본은 유지됐다. 생성 preview 외 서버 쓰기는0이다.
6. 각 탭 실제 reload→권한 조회→보관 초안 명시 복구를 수행해 각자의 다른 제목·질문을 복구했다. 옛 preview는 없어 저장은 다시 미리보기 전 비활성이었다. 복구/reload 추가 쓰기도0이다.
7. 테스트 프록시를 정상으로 복원한 뒤 첫 탭에서 전체 preview201→저장201 한 번→같은 저장 revision 게시 preview201→명시 링크 게시201/버전19를 수행했다. 둘째 탭의 질문·제목·보관 본문은 첫 탭 저장 후에도 그대로였다. 둘째 탭 초안을 저장했다고 집계하지 않는다. 검증 캡처 후 정상 TaskSpace 종료의 탭 수명 범위를 따른다.
8. 첫 탭 저장 결과는 기존 items 전체·sourceId를 보존하고 대시보드 제목만 바뀌었다. 숫자1,269,026,000·169점 추세 시간/값·OS28그룹과 게시 snapshot이 일치했다. SQL/ID/차트/표시/모든 폭 배치와 비대상 최신 OS 제목을 유지했다. 저장 성공 후 첫 탭 보관 key0·편집기 재진입 질문 빈값·복구 안내 없음이다.
9. 공개·게시 관리·저장 화면 실제 reload에서 결과와 추가 저장/게시0을 확인했다. 조회용 `/ai/dashboard-preview` POST는 읽기 계산이다. 링크는 최종20/inactive·인증 헤더 없는 공개 GET404로 중지했다. 정상4899 프록시를 복원했고 제품 서버는 유지했다.

`tab1/2-before/renewed/offer/restored`, `locks-during-renewal`, `proxy-events`, `*-events`, `*-reload-audit`, `tab2-after-first-save`, `saved/reloaded`, `publication/public-*`, `assertions.py/json`이 근거다. 공개 탭은 로그인 세션으로 익명 브라우저 세션 검증은 아니다. 실제 LLM 질문은 실행하지 않고 질문 보존과 직접 미리보기를 확인했다. Rill canonical oracle은 TC005/UC025 증거를 재사용했으며 Rill 화면을 새로 실행하지 않았다. 원본27에는 쓰지 않았지만 전체 원본 재조회는 이번 범위가 아니다.

## 디자인·자동 검사

기능 PASS_SELECTED_VARIANTS / 대표 디자인 PASS. 두 탭 복구·미리보기·게시/공개 화면390/768/1440 CSS폭에서 가로 넘침0을 확인했다. 기존 일반36px/입력36px/도구32px·본문14px/보조12px 크기·정렬·버튼 wrapping을 실제 캡처로 확인했다. 전역 높이 덮어쓰기나 새 설정 UI를 추가하지 않았다. `recovery-offer-*`, `tab1/2-restored-390.png`, `restored-preview-390.png`, `publication-preview-390.png`, `public-active-*`, `public-full-390.png`를 남겼다. 기존 사용자 배치의 큰 세로 공백과 OS/숫자 순서를 보존했다.

원격 통합 전 최종 인증 코드 FE90파일1297개·type/build PASS, 변경 lint 오류0/기존 미사용 경고2다. 추가6개 interceptor 회귀는 독립 axios 모듈2개·공유 lock queue의 refresh1회, 다른 탭 갱신 후 늦은401 재사용, 동일 토큰 새 로그인 시 대기 요청 거절, 잠금 실패 보관/인증 유지,10초 대기 만료 후 명시 재시도, 새 로그인 뒤 도착한 옛401의 재실행 금지를 검증한다. 기존 UC028 helper19/auth17도 유지한다.

격리 핵심8개 PASS(`core.log`, `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-D587Bz/evidence/playwright-001.log`). 실제 잠금 미지원 브라우저는 실행하지 않았고 기본 jsdom의 미지원 경로 회귀를 확인했다. 잠금 대기10초는 fake timer 단위이며 실제 UI의10초 대기는 이번 범위가 아니다.

Main이 작성 후 별도 diff·명세 대조로 요청 세대·승자 재사용·잠금 타이머/해제·획득 실패의 비로그아웃·성공 정리·미지원 한계를 검토했다. 독립 리뷰/사람 승인으로 표기하지 않는다. 문서는 Draft, packet awaiting_review/acceptance not_recorded다. AIWF strict의 기존 오류/경고는 별도로 남기고 기준선을 수용하지 않는다.

## 미확인

Web Locks 미지원 환경의 전역 단일화·잠금 보유 탭 종료/모든 다중탭 실패 조합·실휴대폰·다른 origin의 쿠키 구성·운영DB·전체 제품 수용은 미확인이다.

## 최종 원격 통합

원격 `582c41cf`·`7d2b520e`의 Studio 후속 질문/첫 화면 수정과 증빙을 fast-forward로 보존했다. 공용 auth helper와 직접 충돌은 없으며 원격 AGENTS 항목도 유지했다. 통합 후 auth/draft/GettingStarted/Studio5파일72개·Studio 서버46개·FE type/build·BE build PASS다(`integrated-*`). 원격 전용 Studio 실제 화면을 이번 인증 여정의 증거로 합산하지 않고, 같은 최종 auth 코드의 전체FE1297/core8은 그대로 재사용한다.

strict AIWF는 기존12오류/33경고/4정보이며 신규 기준선 수용은 하지 않았다. pin/check는 문서 일치 증거이고 승인이나 전체 제품 수용이 아니다.

최종 통합 루트 `npm test`는 첫 제한 환경에서 포트 listen EPERM으로 Studio controller 2파일/6개가 실패해 FE가 시작되지 않았다. 같은 명령을 포트 사용 권한 환경에서 재실행해 BE116파일2045개·FE90파일1300개 전체 PASS를 확인했다(`root-test-authorized.log`). 루트 `npm run build`도 BE/FE 모두 PASS다(`root-build.log`). 제품 코드는 환경 오류 때문에 수정하지 않았다.
