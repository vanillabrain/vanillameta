# UC025 브라우저 새로고침 초안 복구 검증 — 2026-10-16

[UC](../use_cases/UC-025-recover-browser-draft.md)·[설계](../architecture/browser-draft-recovery.md)·[TC](../test_cases/TC-025-recover-browser-draft.md)·[계획](../plans/UC-025.md). 기준 develop-v2 `c4936ee1`과 이번 변경. Ego65 하나, 기존 FE3698/API4899→4898/SQLite를 유지했다. 증빙은 `/tmp/vm-uc025/`다. 기존 Aside/다른 브라우저로 대체하지 않았다.

## 구현과 경계

DashboardEdit은 같은 로그인 세션·분석의 기준 revision/정의, 미저장 제목/블록/질문, 선택·목적·폭·충돌/불명확 저장 정보를 sessionStorage에 보관한다. 토큰은 SHA-256 namespace로만 사용하고 원 토큰·서버 결과/행·preview·실행 중 요청은 추가 보관하지 않는다. SQL 정의를 포함할 수 있다는 안내와24시간/UTF-8 256KiB 한도, 버전/타입/블록/배치 경계 검사를 적용했다. 정상 인증 refresh만 같은 탭 scope를 유지하고 새 로그인/로그아웃은 이 기능의 key와 별칭만 제거한다. 사용자 다른 저장소 key는 유지한다.

권한 있는 editor 조회 후 복구/폐기 안내를 먼저 보여 자동 보관 effect가 후보를 덮어쓰지 않게 했다. 복구는 명시 선택이며 preview/history/실행 요청을 복원하지 않는다. revision이 달라지거나 이전 저장 결과가 불명확하면 UC017의 읽기 상태 확인/충돌 복구를 먼저 요구한다. source다름은 복구 불가·폐기만 허용한다. 저장 확인 성공/명시 폐기·최신본 초기화에서 제거하고 실패/취소/불명확 저장은 유지한다. 저장소가 막히거나 가득 차면 메모리 초안을 유지하며 새로고침 전 저장 안내를 표시한다. 서버 DB/API/LLM 모델을 추가·변경하지 않았다.

## 실제 실패→reload→복구→재질문→저장·게시

1. 기존 복사본35/source30의 제목을 “UC025 · 새로고침 후 복구한 미저장 초안”으로 직접 편집하고 “1번 차트의 제목을 새로고침 복구 완료로 바꾸고 저장한 뒤 게시 미리보기로 이어 줘.”를 입력했다. 같은 탭 저장소에 초안/질문이 기록되는 것을 확인했다.
2. 저장소 밖 기존 실패 래퍼를 이번 경로로 복사했다. 정확한 복사본 blockId·생성 prompt에만 기존 선택 정의를2회 반환해 실제 생성 동일성 검사→교정→소진 editor/ai400을 재현했다. `injections.jsonl`은 correction:false/true 두 건이다. intent는 실제 Codex, 이2개 생성 응답은 통제한 주입이며 자연 발생 LLM 반복으로 표기하지 않는다. 추가 저장/게시0·서버 원본 상태 불변이다.
3. 브라우저를 실제 새로고침했다. 새 문서에 복구 안내만 나타났고 자동 AI/save/publish0, 보관 후보는 덮어쓰이지 않았다. **보관한 초안 복구**를 눌러 미저장 제목·질문·2블록/배치/선택 폭을 복원했다. 이전 preview는 없고 저장은 비활성이다. 복구 자체의 추가 서버 쓰기도0이다.
4. 래퍼를 중지하고 기존 정상 bootstrap의4898로 복원했다. “1번 차트의 제목만 새로고침 복구 완료로 바꿔줘.”를 실제 지정 Codex `gpt-6-luna`로 재질문해 전체 미리보기201을 확인했다. 대시보드의 복구한 제목은 유지됐고 변경 대상 제목만 바뀌었다. 원래 요청1,269,026,000·169점 추세·OS28그룹 값/정의·2개 ID·모든 폭 배치는 유지됐다. 서버 저장 revision은 이때까지 시작과 같다.
5. “현재 초안을 저장하고 게시 미리보기로 이어 줘.” → editor 저장201 한 번 → 같은 반환 revision 게시 미리보기201. 성공 직후 feature draft key0을 확인했다. **링크 게시**로 새 UUID·버전6을 게시했다. 기존 중지된 링크는 재활성화하지 않았다.
6. 공개·게시 관리·저장 화면을 실제 새 문서로 reload해 동일 결과·추가 저장/게시0을 확인했다. 읽기 계산 preview POST는 쓰기로 세지 않는다. 편집기를 다시 열어 복구 안내가 재등장하지 않고 질문이 비어 있는 것도 확인했다. 원본27의 editor/publication 전체 응답은 시작과 동일했다.
7. 임시 링크를 명시 중지해 버전7/inactive·공개404를 확인했다. 수정한 복사본35는 비공개로 보존한다. 정상 서버 bootstrap 복원, fault inactive/주입2개로 종료했다.

`draft-before-failure`, `failure`, `offer-storage`, `restored-form`, `retry`, `save-handoff`, `storage-after-save`, `editor-after-success`, `*-reload-audit`, `original-before/after`, `public-active/revoked`, `assertions.py/json`에 남겼다. 독립 oracle/Rill canonical 수치는 기존 TC005/UC022 증빙을 재사용했고 이번에 Rill 화면/AI를 실행하지 않았다. 공개 탭은 다른 origin의 원본 계정 로그인 상태다. 인증 헤더 없는 공개 GET은 확인했지만 익명 로그인 세션 검증을 새로 수행한 것은 아니다.

## UI

기능 PASS / 대표 디자인 PASS. 복구 안내·복구한 질문/초안·AI 미리보기·게시 준비·저장/공개 화면 캡처를 직접 읽고 치수를 확인했다. 소유390/769/1440, 공개390/768/1440 CSS폭에서 가로 넘침0이다. 소유 태블릿768 요청은 기존 origin 확대율 반올림으로 실제769다. 복구 버튼/입력·일반 액션36px, 도구32px·입력16px/본문14px·보조12px를 유지하며 안내 줄바꿈과 버튼 wrapping/정렬을 확인했다. 전역 크기 덮어쓰기를 추가하지 않았다. 고급 설정은 접히고 사용자 기존 아래쪽 숫자 좌표·공백은 보존한다. `recovery-offer-390.png`, `restored-form-390.png`, `ai-preview-*`, `publication-preview-*`, `public-full-390.png`, `saved-full-390.png`가 대표 증거다.

## 검사·리뷰·제한

관련 FE3파일110개(저장소11·인증14·편집85)·FE type·변경 eslint(오류0/기존 apiHelper 경고2)·FE build PASS. 전체 FE90파일1263개와 격리 core8개 PASS 후 baseRevision의 비문자 타입 거절 회귀1개를 추가해 관련110개를 다시 통과했다. 마지막 작은 타입 가드는 해당 targeted/type 검사로 확인했으며 전체1264개를 한 명령으로 실행했다고 집계하지 않는다. core 로그는 `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-vxcEiU/evidence/playwright-001.log`다. BE 런타임 코드가 바뀌지 않아 이전 BE 검증을 반복하지 않았다.

초기 신규 UI 테스트는 복구 후보가 표시된 직후 load-finally가 끝나기 전에 disabled 버튼을 눌러 실패했고, 기존 UC013 fixture도 처음 선택이 비활성 동안 눌렸다. 실제 로드 완료 조건을 기다리도록 고쳐 통과했다. 최초 helper 명령은 잘못된 cwd에서 jsdom 설정 없이 실행돼 실패했으며 FE 프로젝트에서 재실행했다. 제품 로직을 바꿔 fixture/명령 오류를 우회하지 않았다.

별도 executor 읽기 리뷰를 요청했으나 제공자400으로 실행되지 않았다. Main이 구현 후 별도 diff/명세 패스로 hydration·scope·로그아웃/refresh·revision·불명확 저장·성공 정리와 테스트를 대조했다. 독립 리뷰나 사람 승인으로 표기하지 않는다. 설계/UC/TC는 Draft, packet은 awaiting_review/acceptance not_recorded다.

물리 휴대폰/모든 오류 상태·다른 탭의 인증 갱신 경합·브라우저 재시작/탭 종료·다른 기기·운영MySQL·전체 제품 수용은 Open 또는 명시 범위 밖이다. 탭 보관은 서버 저장·백업이나 암호화 보관의 보장이 아니다. 같은 탭 정상 refresh 연결은 helper와 실제 API interceptor 회귀로 확인했으며 실제 장시간 토큰 만료를 기다리는 UI 검증은 하지 않았다.

## 원격 Studio 통합과 기본값 동일성 후속

완료 전 원격의5커밋(`90ff73a8`, Studio shadcn/브랜딩·Commerce 요청 경합·테스트 호환성)을 발견해 현재 변경을 보존한 채 fast-forward 통합했다. UC025 파일 충돌0, 원격 lockfile 그대로 `npm ci --legacy-peer-deps --no-audit --no-fund`를 수행했다. 통합 FE90파일1275개·type/build·격리core8개 PASS(`integrated-full/type/build/core.log`, core `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-w35WMO/evidence/playwright-001.log`). Studio 전환 전체 제품 수용으로 확대하지 않는다.

같은 Ego65에서 통합 후 실패/reload/복구를 재실행하는 중 실제 모델이 요청한 제목을 바꾸지 않은201을 발견했다. suffix 빈값을 생략한 정의가 이전 JSON과 달라 UC022의 단순 직렬화 비교를 통과했다. 최초 통합 시도는 수치가 같았으나 요청 제목 변경은 FAIL이다(`integrated/retry-before-default-fix.json`). 검증 쉘이 앞선 assertion 실패 뒤 다음 브라우저 명령을 계속 실행해 해당 미변경 블록도 저장/버전8 게시됐다. 이를 성공 검증으로 집계하지 않고 다음 최종 재검증과 구분한다.

동일성 비교는 검증된 블록의 키 합집합에 표시 기본값(prefix/suffix/category 빈값, decimalPlaces0, numberNotation full)을 적용하도록 최소 보완했다. 생략/명시 기본값만 다른 응답의 교정/소진 신규2개가 보완 전 실패(red)하고 보완 후 통과했다. BE 생성/편집/게시169개·build·변경 BE eslint(오류0/기존경고6) PASS다. SQL 의미 동치/모든 자연어 적합성 판별로 확대하지 않는다. 이후 `final/` 증빙은 이 보완까지 포함한 코드 기준이다. API 재기동 자동 승인 검토1회 시간 초과는 같은 확인된 PID의 안전한 요청을 한 번 재시도해 정상 수행됐으며 차단으로 남기지 않았다.

최종 재질문의 제목-only 모델 응답이 선택 숫자를 OS 막대로 바꾸는 별도 오응답도 미리보기에서 발견했다(`final/retry-before-title-only-fix.json`). 저장하지 않고 undo로 기존 숫자 정의를 복원했다. 원 질문의 제목만/이름만을 내부 renameOnly로 전달하고 서버가 기존 계산/차트/표시를 보존하도록 보완했다. 분류 editPrompt에서 만이 사라져도 원 질문 기준으로 보존하는 Bi 연결 단언과 잘못 생성된 막대 정의를 무시하는 회귀를 추가했다. BE 관련170개 통과이며 모든 자연어 의미 판별로 확대하지 않는다.

제목-only 보완 후 모델은 짧은 요청 명칭 앞에 새로고침 접두어를 덧붙인 “새로고침 복구 최종 확인”을 반환했다. 미리보기에서 이 제목을 검토하고 숫자/계산/차트가 유지되는 결과로 저장했다. 요청 문자열의 완전 일치 PASS로 집계하지 않는다. 제목의 임의 자연어 완전 일치는 후속 모델 품질 범위로 남긴다.

## 최종 통합 검증 결과

최종 코드는 원격 `90ff73a8`과 초안 복구·두 AI 경계 보완을 포함한다. 같은 Ego65에서 `final/`의 실패 주입2회→400→실제 reload→명시 복구→정상 Codex 재질문→전체 미리보기→명시 저장/게시 준비→재게시→reload를 통과했다. `final/assertions.json`은 복구/새로고침 쓰기0, 제목·질문 보존, 저장 후 보관 key0, 원본27/비대상 블록·모든 폭 배치 보존, 요청1,269,026,000·추세169점·OS28그룹을 확인한다. 제목은 위에 명시한 모델 반환 제목을 검토한 결과다.

같은 링크를 버전9로 재게시해 숫자+시계열을 확인한 뒤 중지했다. 최종 버전10/inactive·인증 헤더 없는 공개 GET404이며 복사본35만 비공개로 유지한다. 저장·게시 관리·공개 화면의 실제 reload에 추가 저장/게시0, 다시 연 편집기에 복구 안내/질문이 남지 않음을 확인했다. 정상 API bootstrap으로 복원했고 모든 임시 fault는 inactive다.

최종 `final/recovery-offer-*`, `restored-form-390`, `ai-preview-*`, `publication-preview-*`, `public-active-*`, `public-full-390`, `saved-final`, `saved-full-390`의 캡처와 치수에서 소유390/769/1440·공개390/768/1440 가로 넘침0 및 기존36px 일반 컨트롤·32px 도구 정렬을 확인했다. 최종 BE 관련3 suite170개·build PASS, 통합 후 FE90파일1275개·type/build·core8개 PASS다. BE lint 오류0/기존경고6, 변경 FE lint 오류0/기존경고2다. 독립 리뷰·실휴대폰·전체 제품 수용은 위 제한대로 미확인이다.
