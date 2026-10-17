# VanillaMeta — 개발자/에이전트 가이드

## 세션 시작 핵심 지침

- **최상위 목표:** 프롬프트로 대시보드 생성·수정·저장·게시를 이어가고, 반응형 블록 편집과 복제·소스 교체·재사용까지 완성한다. [제품 목표](docs/strategy/prompt-to-dashboard.md)가 우선순위의 기준이며 [통합 설계](docs/architecture/prompt-to-dashboard.md), [UC-005/계획](docs/plans/UC-005.md)에 구현·검증 계약이 있다. UC-001~004와 Rill 작업은 이 전체 여정을 지원하는 기반이다.
- **방향 유지:** 새 작업은 P1~P5/FR/수용 기준과 연결하고 부족점·최소 변경·검증·종료 조건을 기록한다. 블록 ID·공통 AI 초안·복제/undo·화면 폭별 좌표 편집은 구현했으며 최신 [UC-009 증빙](docs/testing/responsive-block-layout.md)은 단위/실LLM/API PASS, 실제 UI BLOCKED다. [UC-010](docs/testing/pointer-block-layout.md)의 포인터 drag/resize 연결·키보드 편집은 컴포넌트/API PASS이며 실제 키보드·저장·새로고침과390/768/1440 대표 화면을 확인했다. [Ego 후속 증빙](docs/testing/pointer-block-layout.md#ego-실제-포인터-후속--2026-10-15)에서 분석22의 데스크톱/390px 모바일 배치 실제 마우스 drag/resize→미리보기→저장→reload→좌표 재조회와390/768/1440 저장 화면·컨트롤 정렬을 확인했다. [Ego 터치 후속](docs/testing/pointer-block-layout.md#ego-모바일-터치겹침경계-후속--2026-10-15)은390px Chromium 터치 에뮬레이션 drag/resize·겹침/좌상우 경계·최소/최대 너비·undo/redo→저장→reload를 확인했다. 작은 가로 차트의 축 라벨 공간 문제도 수정했다. 실제 휴대폰/멀티터치는 미검증이다. 이전 data: 오류 탭의 프로토콜 거절을 전체 브라우저 차단으로 일반화하지 말고 정상 HTTP 연결 상태를 확인한다. [UC-011](docs/testing/ai-block-layout.md)의 선택 블록 AI 배치 변경은 단위/실LLM/UI 저장·새로고침을 확인했다. 목적을 배치로 선택한 요청만 선택 폭에 적용한다. [연속 편집 회귀](docs/testing/block-editor-continuity.md)는 복제→직접→내용 AI→배치 AI→4단계 undo/redo→저장·새로고침을 확인했다. 과거 추가 모바일 차단 후 사용자 지정 Ego에서 [모바일 연속 편집 후속](docs/testing/block-editor-continuity.md#ego-모바일-후속--2026-10-15)을 수행해 복제→직접 제목→내용 AI→한 칸 배치 AI→4단계undo/redo→저장/reload와 비대상 정의/배치 불변을 확인했다. 실패 후 이전 성공 안내가 남는 오류도 수정했다. 임의 좌표 배치 문장의 unsupported 반환·실제 휴대폰은 남아 있다. P1 실제 터치/모든 경계 변형 gate는 Open이며, [UC-012 설계](docs/architecture/semantic-creation.md)는 P2 지표·원본 열 차원·분석의 제안/재사용·원자 저장 계약이다(Draft). [계획 A](docs/plans/UC-012.md)의 쓰기 없는 구조화 제안/미리보기 API는 단위90개·실LLM/API·Rill Parquet 수치 및 미리보기 DB 내용 불변을 확인했다([증빙](docs/testing/semantic-proposal.md)). [계획 B](docs/testing/semantic-creation-save.md)의 원자 저장·영수증 재시도·지표 링크는 단위/SQLite134개와 실제 API 검증을 완료했다. [C 기존 질문 UI 연결](docs/testing/semantic-creation-ui.md)은 FE60개·type/lint/build·실LLM/API 저장·재조회 PASS다. 생성은 구조화 API, 기존 수정은 종전 경로를 유지한다. 과거 Aside 차단 후 사용자가 명시 승인하고 Ego를 지정했다. Ego 실제 질문→미리보기→분석22 저장→새로고침/XHR·390/768/1440 대표 화면·Rill 수치/화면 비교를 확인했다. 저장 화면 부모 크기 덮어쓰기를 제거해 주요 버튼28px/입력32px를 실측했다. 운영 MySQL·모바일 오류/로딩 전체 상태·P1 실제 터치·제품 전체 수용은 미검증이다. 분석12의 공개 Rill 데이터 임시 익명 공유는 사용자 명시 허용 후 API 조회/기간갱신/중지를 검증했고 현재 중지 상태다. 지표를 먼저 저장해 미리보기를 만들지 않는다. 전체 여정에 직접 기여하지 않는 Rill 기능 고도화로 우선순위를 바꾸지 않는다.
- **P3 현재:** [UC013 의도](docs/testing/auto-block-intent.md)·[UC014 명시저장](docs/testing/prompt-save.md)·[UC015 대상](docs/testing/prompt-target.md)·[UC016 다중변경](docs/testing/batch-block-edit.md)을 구현했다. [UC017 복구](docs/testing/editor-recovery.md)는409/저장결과불명확에서초안·질문을보존하고읽기상태확인→동일저장확인또는최신본과제한병합→전체재미리보기/저장으로연결한다. 같은단위충돌은명시적으로내변경을선택하며비대상최신변경은유지한다. Ego실제2탭409·commit후본문유실/GET추가쓰기0·미전달/조회503복구·실제Codex시작후취소/종료·같은질문재시도/save/reload와390/768/1440패널28/32px·넘침0을확인했다. 구조변경자동병합·브라우저reload후영구초안·모든지표활성변형·운영/실기기·게시·전체P3/TC005는미완료다. 게시 연결은 아래 UC019를 따르며 P3 잔여 복구 경계와 전체 수용은 Open이다.
- **P4 현재:** [UC018 게시](docs/testing/publication-snapshot.md)는 저장본 전체기간/필터없음/UTC의 집계snapshot 미리보기→명시링크게시·재게시·중지다. SQL/원본/토큰 공개없이 숫자+추세·차트·논리배치를보존하고 활성재게시URL유지/중지·만료후새URL·마지막요청재시도/버전CAS를구현했다. BE125/FE31·type/lint/build, Ego분석12 게시→저장제목수정에도게시본불변→재게시→중지404→새URL재개/옛URL404→최종중지와390/768/1440을확인했다. 기존live공유는별도이며분석12는공유N/새게시activefalse다. SQLite1MiB/MySQL60KiB추가한도,안전집계증명기의240그룹제한을따른다. 운영MySQL/실휴대폰·계정수신자·전체P4/TC005는미완료다. [UC019 질문 게시](docs/testing/prompt-publication.md)는 명시 저장+게시 질문을 검증 초안 저장→같은 revision의 게시 미리보기→명시 링크 게시로 연결한다. BE142/FE97·type/lint/build, Ego 실제 질문/저장/미리보기/게시/reload·추가쓰기0·부정 게시 질문의 저장만 실행·버전 불일치 차단·390/768/1440을 확인했다. 저장 실패·취소는 이동하지 않고 미리보기 실패는 저장을 보존한다. 원격 shadcn UI(3e6c5ab4)를 보존해 통합한 뒤 BE250/FE102·type/lint/build와 Ego 추가 공간38에서 같은 실제 여정을 재검증했다. 새 UI 기본 버튼/입력36px·도구32px, 입력16/14px와 질문/날짜행 정렬·넘침0을 확인했다. 루트 전체 BE1617/FE981·build도 통과했다. 분석12는 원복·게시version9중지/익명404다. 다음은 P4/P5 복제·소스 교체·재사용 여정의 부족점 확인이며 전체 TC005 수용은 Open이다.
- **P5 현재:** [UC020 재사용](docs/testing/dashboard-reuse.md)은 소유 저장본 복제→DuckDB 소스/열 연결→전체 미리보기→원자 저장→새로고침이다. 새 대시보드/블록 ID·비공개 복사본과 모든 폭 배치를 보존하고 원본·지표·게시를 유지한다. ticket/requestId 재시도·SQLite rollback/권한/revision·Ego 분석12→23 및 새 소스 oracle·390/768/1440 정렬/넘침0을 확인했다. 공유 수신자 remix·질문 복제·운영MySQL·다른 생성 흐름과 SQLite 동시 경합·실휴대폰·전체P5/TC005는 Open이다. 검증 복사본23/소스23·24는 로컬 비공개로 보존했다. 다음은 공유/게시본 재사용의 권한 경계를 좁게 설계한다.
- **P5 공유/게시 후속:** [UC021](docs/testing/shared-dashboard-reuse.md)은 소유자 명시 허용·수신자 로그인·본인 파일 소스로 재사용한다. 공유는 현재 저장 정의, 게시는 private 고정 recipe를 사용한다. 새 API는 원본 SQL/소스/결과를 반환하지 않지만 허용한 계산식·필터 조건은 저장 복사본 소유자가 편집할 수 있음을 UI에 명시한다. 기존 live 공유는 제한 위젯 읽기 토큰을 유지하고 저장 SQL 정의는 응답에서 제거했다. Ego 두 계정 공유25/게시26 저장·reload, 소스27 oracle·403/401·중지404/내복사본200/영수증재확인·390/768/1440을 확인했다. 임시 링크·grant는 중지했다. 운영MySQL/실휴대폰/전체TC005는 Open이며 다음은 복사본AI편집→게시 통합 여정 점검이다.
- **복사본 통합 현재:** [UC022](docs/testing/copy-ai-publication.md)은 수신자 복사본26/source27의 AI 계산식2배/별도 제목 수정→전체 미리보기→명시 저장/게시 준비→같은 링크 버전1/2→소유·익명 reload를 Ego44에서 확인했다. 원본23·복사본25·비대상 정의/ID/모든 폭 배치 보존, 신규 제품 코드 없이 회귀1개 추가·BE166/FE104·type/lint/build PASS다. 게시 링크는 최종 중지했다. 실제 GET403/401와 서버 변경 거절 회귀는 확인했고 타 계정 변경 POST 실제 실행은 자동 승인 검토 거절로 NOT_RUN이다. 소유390/767/1440·익명390/768/1440을 실측했다. 최신 shadcn UI Kit의 일반36px/도구32px/입력36px를 따른다. 운영/실휴대폰·임의 자연어/미지원 AI식 게시 복구·전체TC005는 Open이며 다음은 전체 여정과 남은 gate의 선택 검증이다.
- **TC005 최신 통합:** [전체 여정/UC023 증빙](docs/testing/dashboard-lifecycle.md)을 우선한다. Ego45·전체 Rill1,391,572행/source28에서 생성/지표19재사용/Dimension→직접·AI·모바일 touch emulation 편집→저장/게시→다른 계정 새 소스31 복사본29→재게시/중지의 주 여정과 선택 오류를 검증했다. 생성 후 저장 질문이 새 제안으로 처리되는 공백은 [UC023](docs/architecture/creation-lifecycle.md)의 frozen proposal/digest 후속 질문과 신규 저장 revision handoff로 보완했다. receipt replay는 과거 revision을 증명하지 않아 게시 수동 미리보기를 요구한다. 실제 공개 금지는 명시한 게시 준비까지 취소하지 않는다. 전체BE1681/FE1017·root build·core E2E8개 PASS. owner390/768/1440, 수신자·익명390/769/1440 실측·넘침0이며 실제 휴대폰/운영MySQL·모든 자연어/경합·기존 거절된 타 계정 변경POST·사람 제품 수용은 Open이다. 과거 각 문서의 전체TC005 not_run은 역사적 상태이며 최신 검증 범위는 이 증빙을 따른다.
- **누락 소스 후속:** [UC024 증빙](docs/testing/reuse-block-selection.md)은 TC005 A4의 영향 블록별 필드 표시·명시 제외→남은 미리보기→비공개 복사본33/source30 저장/reload를 추가했다. 원본 순서·모든 폭 좌표·새ID·원본27 불변, 선택 복원 시 ticket 무효화, 임시 링크 중지/복사본 독립성을 Ego55에서 확인했다. BE43/FE33·통합전 전체BE1691/FE1019·root build/type/lint PASS. 원격Studio 병합 후 단위의 환경 실패 재실행·build/type·복사DB/기존 API·격리core8개 검증과 Ego 기준 차이는 같은 증빙에 기록했다. Studio 통합 후 Ego56에서 UUID 게시→다른 계정 source30→평균 블록 제외→미리보기→복사본34/35 저장/reload를 재검증했다. 선택 후 남던 소스 안내를 수정했고 FE10/type/lint/build·390/769/1440 넘침0·원본/배치/수치 보존·reload 추가쓰기0을 확인했다. 임시 게시version8은 중지했다. Ego59 [제외 복사본 AI 후속](docs/testing/copy-ai-publication.md#uc024-제외-복사본-후속--2026-10-16)은 복사본35/source30의 요청2배(1,269,026,000)·169점/OS28 불변→저장→같은 링크 게시1/2→reload·원본27/ID/배치 보존을 확인했다. 변경 없는 AI 선택 응답은 교정2회 후 실패하도록 보완했고 BE167/FE102·BE build/lint·FE type PASS다. 링크는 version3중지했다. [Ego60 반복 무변경 복구](docs/testing/copy-ai-publication.md#반복-무변경-응답-실패와-재질문-복구--2026-10-16)는 생성 경계 동일 정의2회 주입→실제400·미저장 제목/질문/undo 보존·쓰기0→실제Codex 재질문/미리보기→정상 서버 저장/게시/reload를 확인했다. FE80·BE선택2/type/lint PASS, 추가 제품 수정 없이 회귀1개를 추가했고 링크는 version5중지했다. 레거시 layoutSizes도 선택 인덱스로 줄인다. 기본 전체 포함/자동 제외 없음·기존 opt-in/권한/버전 경계를 유지한다. 운영/실기기·제품 수용은 별도다.
- **새로고침 초안 복구:** [UC025](docs/testing/browser-draft-recovery.md)는 같은 로그인 세션·탭의 sessionStorage(24h/256KiB)에 초안·질문을 보관하고 권한 조회 후 명시 복구/폐기를 제공한다. revision다름/저장불명확은 UC017 상태 확인을 요구하고 preview/요청을 자동 재실행하지 않는다. 정상 refresh scope 유지·새 로그인/로그아웃·저장 성공 정리를 회귀로 확인했다. 원격90ff73a8 통합 후 Ego65에서 생성 경계 무변경2회→실패→reload/명시 복구→실제Codex 재질문→복사본35 저장/게시/reload와 원본27·ID/배치·수치 보존·추가쓰기0을 확인했다. 표시 기본값 생략의 무변경 우회와 제목만 요청의 차트 변경도 보완했다. BE170/build·통합FE1275/type/build·core8 PASS, 소유390/769/1440·공개390/768/1440 넘침0. 임시 링크version10중지·정상 서버 복원, 제목 자연어 완전 일치/실휴대폰/다른 탭 refresh 경합·운영/전체 수용은 Open이다.
- **다른 탭 변경 후 초안 복구:** [UC026](docs/testing/concurrent-browser-draft.md)은 복구 전 revision 차이 안내→명시 복구→최신 상태 GET→같은필드 명시 선택/다른필드 보존→최신 revision 재미리보기/저장을 따른다. Ego66 두 탭의 제목 충돌+비대상 OS 제목 보존·저장/게시11/reload·추가쓰기0·저장 후 초안/질문 제거와390/769/1440 넘침0을 확인했다. FE 관련106/type/lint/build 및 원격4ba84614 통합 후 Studio 포함133/type/build PASS, 링크는 최종12중지/404다. 충돌 중 재reload·조회 실패·재경합409는 컴포넌트 회귀이며 다른 탭 인증 갱신 경합·실휴대폰/운영·전체 수용은 Open이다.
- **조회 실패·재충돌 복구:** [UC027](docs/testing/retry-editor-recovery.md)은 Ego67에서 초안 복구→실제 GET503(정확1회 주입)/질문·초안·잠금 보존→재조회/병합/preview→둘째 탭 실제 저장 후 서버409/무변경→재조회/새 병합·preview/저장→게시13/reload를 확인했다. 최신 비대상 OS 제목·SQL/ID/모든 폭 배치·수치 보존, 관련FE107/type/lint/build·390/769/1440 넘침0 PASS다.409 안내는 보존형 저장 상태 확인을 권한다. 링크는 최종14중지/404·정상 프록시 복원이다. 반복503 전체 조합·실휴대폰·인증 갱신 경합/운영·전체 수용은 Open이다.
- **다른 탭 정상 토큰 갱신:** [UC028](docs/testing/cross-tab-token-draft.md)은 탭별 본문을 유지하고 공유 localStorage의 로그인 세대·현재 tokenHash·안정 scope로 정상 refresh를 연결한다. 새 로그인/로그아웃·동일토큰 재로그인은 세대를 교체하며 늦은 갱신 성공/실패와 낡은 key 계산이 새 인증/별칭을 덮지 못하게 했다. Ego68 최종127호스트 두 탭401(1회 주입)→실제 refresh201/재요청200→첫 탭 이전 별칭/reload/명시 복구→preview/저장/게시17/reload, 제목·질문/정의·배치·수치 보존·추가쓰기0·390/768/1440 넘침0을 확인했다. FE1290/type/lint/build·core8, 원격ca8305ae 통합 후 관련130/type/build PASS, 링크는 최종18중지/404·정상 프록시 복원이다. 다른 탭 정상 갱신은 확인했지만 다중 탭 동시 refresh 단일화·실휴대폰/운영·전체 수용은 Open이다.
- **다중 탭 동시 갱신:** [UC029](docs/testing/concurrent-token-renewal.md)은 요청의 로그인 세대를 기록하고 지원 브라우저의 같은 origin Web Locks에서 refresh/scope승계/토큰저장을 조정한다. 대기 탭은 같은 세대의 새 토큰으로 재요청하고 새 로그인은 넘지 않는다. 잠금 실패/10초 대기는 인증·초안을 지우지 않으며 미지원은 기존 탭 내부 경로다. Ego69 두 탭 만료401두건(표식 preview에만 주입)·실제held1/pending1·refresh201한번·preview201두건→양쪽독립초안reload복구→첫탭저장/게시19/reload를 확인했다. 둘째초안 유지·정의/수치/배치·390/768/1440 넘침0, FE1297/type/lint/build·core8, 원격7d2b520e 통합 후 FE72/BE46·양쪽build/type와 루트전체BE2045/FE1300·build PASS다. 링크는 최종20중지/404·정상 프록시 복원이다. 미지원전역단일화/모든실패·실휴대폰/운영·전체수용은 Open이다.
- **갱신 장애·탭 종료 복구:** [UC030](docs/testing/retry-token-renewal.md)은 refresh401/403만 기존 인증거절 정리하고503/통신/timeout/잘못된응답은 인증·초안을 보존해 명시 재시도한다. Ego70 실제401→refresh503한번→reload/명시복구→실제refresh201/preview201, 두탭held1/pending1→보유탭종료→대기탭refresh/preview→저장/게시21/reload를 확인했다. 종료변형은 서버처리된 닫힌탭refresh+살아있는탭refresh2회이며 닫힌초안 복구/서버rollback을 보장하지 않는다. 정의/수치/배치·질문 보존·추가쓰기0·390/768/1440 넘침0, 전체BE2045/FE1306·type/lint/build·core8 PASS다. 링크22중지/404·정상프록시복원이며 실휴대폰/모든장애/운영/전체수용은 Open이다.
- **Studio 새 생성 저장 확인:** [UC031](docs/testing/confirm-studio-creation.md)은 Ego71 실제 지정Codex 제안→전체미리보기→명시저장 commit201뒤503치환→입력/소스/수정잠금→동일요청재확인/기존36→reload를 확인했다. 제품코드변경0·FE회귀보강9/BE46·type/lint PASS, 직전 전체검사는 재사용했다. dashboard/영수증증가각1·지표2·게시0·원본35불변·634,513,000/OS28개독립oracle일치·390/768/1440넘침0이며 정상프록시복원/비공개36보존이다. 불명확상태 자체의reload request복구·운영/실기기/전체수용은 Open이다.
- **Studio 저장 확인 reload:** [UC032](docs/testing/recover-studio-creation.md)은 최소요청/질문만24h/8KiB·기존authscope의탭저장소에선보관하고 reload후권한조회→명시동일요청확인으로복구한다. Ego72 commit후503→reload/자동POST0→기존37·기록정리/저장본reload와초기sources503→잠금/기록보존→재조회도확인했다. 중복생성/게시0·원본35불변·634,513,000/OS28 oracle·390/768/1440넘침0, 관련24/전체BE2045·FE1321·build/type/lint·core8 PASS다. [A5 Ego73](docs/testing/recover-studio-creation.md#a5-미전달-저장-후속--2026-10-16)은 서버전달전503→reload/질문복구까지DB0→동일요청명시확인/최초비공개38저장1→API재전송동일ID/추가생성0·저장본reload쓰기0을확인했다. 관련FE24/BE46·oracle/원본35보존·390/768/1440넘침0 PASS이며 제품코드변경0이다. 정상proxy복원·비공개37/38보존이며 캐시만료/서버재시작뒤최초저장·실기기/모든경합/운영/전체수용은Open이다.
- **잔여1–5 통합 최신:** [Ego74/UC032 A6 증빙](docs/testing/studio-completion-1-5.md)은 미전달→실제서버재시작→질문/소스유지·명시재제안→39저장, 대화분모확인→원질문새탭복원→금액환불률21.23%/40게시→새DECIMAL소스34/10%복제41→AI제목/저장/비공개게시/reload를확인했다. 뒤의보존문장이명시저장을가리던문제도문장별동의·인용제외/부정우선으로보완하고실제복합질문저장/reload를확인했다. 관련FE34/전체FE1328·BEcreation48/execution57·전체BE2047범위(포트실패6재검증)·build/type/lint/core8 PASS. 원본35/39/40·ID/SQL/배치보존,390/768/1440넘침0, 임시40/41게시중지·익명410·복사본소유조회200이다. 원격2fb2edb4/e2e5b715통합후관련106·BEbuild/lint·Ego저장41reload/GET만을재확인했다. MySQL은사용자지정으로나중에로컬Docker, 고객데이터/실휴대폰/VoiceOver/운영부하/전체수용은미완료다. 과거새요청으로만안내하던의미확인은선택한원제안handoff범위에서갱신한다.
- **제품 계약:** 고객에게 모드/내부 구조 선택을 기본 선행 단계로 요구하지 않는다. AI와 직접 편집은 같은 블록 정의·배치를 수정하고, 기존 비대상 블록을 유지한다. Source·Measure·Dimension·Block·Dashboard·Publication 책임은 분리한다. 초안과 게시 버전, 원본과 복제본을 구분한다. 목표 전체 완료의 기준은 TC-005 실제 여정이며 주 여정 실행과 전체 수용·운영 gate는 최신 통합 증빙에서 구분한다.

- **Studio 생성 질문 후속:** [UC033 증빙](docs/testing/inline-creation-clarification.md)은 환불률 분모를 같은 대화에서 선택→미리보기→명시 비공개 저장으로 연결한다. Ego75 금액/주문 기준·응답 교체503/동일 답변 복구·저장42/reload·원본39/35 불변·390/768/1440 넘침0을 확인했다. 필수 열 질문은 기존 소스 확인 연결을 유지한다. 운영MySQL/실휴대폰/전체 수용은 별도다.

- **Studio 필수 열 복구:** [UC034 증빙](docs/testing/inline-source-recovery.md)은 같은 카드 소스 교체→원 질문/이전 분모 유지→미리보기→명시 저장이다. Ego76 Rill 열 누락/다른 소스에도 누락·source32 복구/저장43/reload·원본35 불변·390/768/1440 넘침0을 확인했다. UC033의 필수 열 별도 이동은 이 흐름으로 보완하며 대체 소스가 없으면 준비 링크를 제공한다. 목록/불명확 응답 오류는 컴포넌트 회귀이고 운영/실휴대폰/전체 수용은 별도다.

- **Studio 생성안 수정:** [UC035 증빙](docs/testing/inline-proposal-refinement.md)은 같은 카드의 접힌 수정 영역에서 대상 블록/추가 질문→전체 미리보기→명시 저장이다. Ego77 실제400/질문·이전 결과 보존→제목만 수정/비대상·ID 유지→총매출 추가→비공개44/reload·원본39/35 불변·390/768/1440 넘침0을 확인했다. 불명확 응답 잠금/동일 재시도는 컴포넌트 회귀이고 실휴대폰/운영/전체 수용은 별도다.

- **Studio 입력창 후속:** [UC036 증빙](docs/testing/creation-composer.md)은 최신 미저장 생성안을 기존 입력창에 표시하고 번호/유일 제목 수정·추가→전체 미리보기→단독 명시 저장으로 연결한다. Ego78 부정/모호 요청400·제목 수정/추가/비공개45·원본39/35 보존·390/768/1440을 확인했다. 원본 복귀는 입력 보존/자동 전송0이며 저장 후 대상 유지는 UC037을 따른다. 불명확 응답은 동일 envelope로만 재확인하며 카드/입력/대상 변경을 잠근다. 모든 자연어·실휴대폰·이번 UC의 MySQL/전체 수용은 별도다.
- **Studio 생성 저장 후 게시:** [UC037 증빙](docs/testing/creation-publication.md)은 저장한 새 대시보드 ID·revision을 기존 입력창 대상으로 유지하고 단독 “게시 준비해 줘”→AI 패널 닫기→기존 상위 게시 창의 명시 범위/버튼으로 연결한다. 원본으로 자동 요청하지 않으며 상단 원본 게시 버튼은 별도 문맥을 복원한다. Ego79의45번 게시1/2·익명/reload·중지410·원본39/35·새45 정의/배치 보존과390/768/1440 클릭/포커스/넘침0을 확인했다. 게시 준비는 설정 창이며 신규 집계 snapshot 미리보기는 아니다. 실휴대폰/이번UC MySQL/임의 자연어 전체/사람 수용은 별도다.
- **Studio 게시 충돌 복구:** [UC038 증빙](docs/testing/publication-conflict.md)은409 후 같은 저장 버전의 게시를 잠그고 정확한 대상의 최신 Studio를 새 탭으로 열어 실데이터 확인→명시 게시로 이어간다. Ego80 두 탭 저장→실제409→45번 링크/최신 미리보기→게시1/reload→중지410과390/768/1440 정렬/넘침0을 확인했다. 원본39 불변·45 제목/정의/배치는 복원했으며 정상 저장으로45 revision은 새 값이다. 이전 생성 저장 영수증을 갱신하지 않는다. 같은 기준의 닫기/reopen·게시 상태 GET만으로는 잠금을 해제하지 않는다. FE47/type/lint/build/core8·실제 증빙40개 PASS이며 조회 실패/재경합 전체·운영/실기기/사람 수용은 별도다.
- **Studio 최신본 조회 복구:** [UC039 증빙](docs/testing/latest-dashboard-read.md)은 최신 링크의503→명시 재시도→최신 미리보기→게시1/reload→중지410과 타 소유27 실제GET403의 데이터/편집/게시 없음,390/768/1440을 Ego81에서 확인했다. 경로 변경 후 이전 조회 오류가 현재 정상 화면을 덮는 회귀를 수정했고 요청 세대/문서ID 일치를 확인한다. 원본39·저장45 정의/배치/revision 불변, 정상 프록시4899(PID71094)로 복원했다. FE60/type/lint/build/core8·실제 증빙46개 PASS다.45의 실제 권한 회수·브라우저 지연 경로 전환·실기기/운영/사람 수용은 별도다.
- **Studio 게시 재충돌:** [UC038 A2 증빙](docs/testing/publication-reconflict.md)은 Ego82의 활성 게시1→첫409→최신R0 조회→다른 탭 저장R1→두 번째409→최신R1 확인→같은URL 재게시2/reload→중지410을 확인했다. 두409 동안 공개 본문/URL/version1 불변, 원본39 불변·45 제목/정의/배치 복원(정상 저장으로revision 새 값),390/768/1440 넘침0이다. 제품 코드는 그대로이며 회귀1개 추가/선택20테스트·type/lint·실제 대조48개 PASS다. build/core는 제품 소스가 같은 UC039 결과를 재사용한다. 모든 경합/권한 회수·실기기/운영/사람 수용은 별도다.
- **Studio 생성 진입:** [UC040 증빙](docs/testing/studio-entry.md)은 목록 AI 생성 메뉴와 홈 시작 카드를 `/studio/new`로 통일한다. Ego83에서 source32 선택/질문 입력·GET3/쓰기0·390/768/1440 넘침0, FE20/type/lint를 확인했다. 기존 `aiSourceId` 패널 링크는 유지한다. 생성·저장·게시 엔진은 미변경이며 전체 제품 수용은 별도다.
- **Studio 목록 재진입:** [UC041 증빙](docs/testing/studio-list-reentry.md)은 Dashboard 분석 행의 별도 Studio 링크와 제목 조회/이름 수정·삭제 보존을 따른다. Ego84 저장45 재진입/reload·정의/배치/revision/수치 불변·조회만 실행,390/768/1440 날짜 열/96×32px 링크·넘침0·390px Tab/Enter와 FE10/type/lint/build를 확인했다. 실제 지원/권한 검사는 서버가 유지하며 일반 위젯 목록에는 링크를 추가하지 않는다.
- **Studio 목록 탐색:** [UC042 증빙](docs/testing/studio-list-navigation.md)은 도구줄 목록을 새 탭으로 열어 기존 편집을 유지한다. 패널 닫기 시 질문 손실을 Workspace 입력 소유로 수정했다. Ego85 블록 복제/질문→패널 닫기/목록 새 탭/재열기·390px Sheet 보존→undo 원복·저장45 응답 불변·GET만,390/768/1440 넘침0/링크32px14px와 FE53/type/lint/build를 확인했다. 전체 이탈 가드·reload 영구 복구/실행중 전체 상태 보존은 별도다.
- **Studio 저장 확인 reload:** [UC047/Ego92 증빙](docs/testing/studio-save-recovery.md)은 정확한 저장 요청/문서 합계256KiB/24h 보관→권한GET→명시 같은 요청 확인→현재 최신GET→편집 복귀다. 자동POST/새ID/게시 없이 commit후503의 기존 영수증·미전달503의 최초저장1·질문 보존·46 원복/45 불변·390/768/1440 넘침0/32px와 FE111/type/lint/build·실제31개를 확인했다. 보관 실패는 전송 차단·확정 후 조회 실패는 GET만·409는 명시 초안 복귀이며 후자는 회귀 범위다. 임시 신규 블록ID는 아래 Ego93 후속을 따르며 확정 후 조회 실패 reload 실제 검증·모든 경합/운영/실기기/전체 수용은 별도다.
- **Studio 병합 장애 후속:** [UC046 A3/Ego91](docs/testing/studio-draft-retry.md)은 별도4901의 표식GET503 정확1회→정상4899 재조회/동의→둘째 탭 실제 재저장/preview409→최신 재조회/재동의/미리보기/저장/reload를 확인했다. 실패 중 초안·질문 원문/서버 무변경·동의 초기화·비대상 최신 제목/ID/모든 폭 배치/수치 보존과390/768/1440 넘침0·32px, FE44/type/lint·실제36개 PASS다. 제품 소스 변경0·기존서버 유지/별도 응답기 종료·46 내용 원복/45 불변이다. 반복 장애·저장불명확 reload·실기기/운영/전체 수용은 별도다.
- **Studio 다른 탭 초안:** [UC046 증빙](docs/testing/concurrent-studio-draft.md)은 SQL 없는 기준을 포함한v2 보관→명시 최신 조회/3방향 비교→같은 항목의 내 초안 동의→전체 미리보기→저장/reload다. 비대상 최신 변경·새 복제 블록 모든 폭 배치를 보존하며 소스/정의 교체·삭제 대상·배치 오류는 보존형 차단한다. Ego90 두 탭 실제 저장/reload/비교/동의/질문 복구/저장·원본45 불변/46 내용 원복·390/768/1440 넘침0/32px와 FE101/type/lint/build를 확인했다. 확정 저장 후 후속 조회 중 reload의 낡은 기록도 정리한다. v1 다른 버전 병합·저장불명확 reload·실기기/운영/전체 수용은 별도다.
- **Studio 블록 reload:** [UC045 증빙](docs/testing/studio-document-recovery.md)은 같은 로그인/탭/대시보드의 문서·기준 버전을24h/256KiB로 보관한다. 권한 조회 후 같은 revision/source에서만 명시 복구→서버 전체 미리보기→미저장 편집/명시 저장이며 자동 쓰기0이다. Ego89 제목/복제/배치→reload/복구/저장/reload·원본45 불변/46 내용 원복·390/768/1440 넘침0·버튼32px와 FE91/type/lint/build를 확인했다. 기준 불일치·장애/지연 중 새 편집·인증 scope는 회귀이며 다른 버전 병합·저장불명확 요청 reload/실기기/고객 수용은 별도다.
- **Studio 질문 reload:** [UC043 증빙](docs/testing/studio-question-recovery.md)은 같은 로그인/탭/대시보드의 미전송 질문만24h/8KiB·2000자로 보관해 권한 조회 후 명시 복구/폐기한다. 늦은 조회·현재 입력 덮어쓰기/자동 전송을 막고 저장소 오류는 비차단 안내한다. Ego86 입력/reload/390px Enter 복구·다른39 분리·폐기/reload·저장45 응답 불변,390/768/1440 넘침0·32px 버튼과 FE61/type/lint/build를 확인했다. 공통 배너의 width+margin 넘침도 수정했다. 블록/실행 reload 복구·실기기/고객 수용은 별도다.
- **Studio 저장본 재사용:** [UC044 증빙](docs/testing/studio-copy-handoff.md)은 도구줄 저장본 복제를 새 탭으로 열고 소유 복제의 `editor=studio`일 때만 새 복사본 Studio로 연결한다. Ego87 원본45 미저장 블록/질문 보존→source34/10%·300 독립 Parquet 대조→비공개46 저장/reload·새ID/모든폭배치/원본서버응답불변·질문/undo 원복,390/768/1440 넘침0·32px 링크와 FE48/type/lint/build를 확인했다. 미저장 변경은 복제하지 않으며 공유 수신자/기본 이동·권한 계약은 유지한다. 실기기/운영/고객 수용은 별도다. Ego88 후속에서46 선택 제목 실제 AI 수정/계산검증→명시저장/reload·원본45/SQL/ID/배치/10%/300 보존·세폭 넘침0을 확인했다. 제품코드변경0/직전검사재사용·실제대조13개 PASS이며46 제목은 원복하고 정상저장으로revision만 새 값이다.

- **Studio 병행 흐름:** T10~T15의 대화·원자 저장·게시·내 데이터 복제 증빙은 docs/testing/dashboard-studio.md를 따른다. 기존 분석 편집 흐름 UC012~022의 증빙과 구분하며, Studio 흐름 자체의 잔여 조건은 PARTIAL이며, 분석 흐름의 UC023 전체 여정 증빙과 혼동하지 않는다. gpt-6-luna 및 VoiceOver BLOCKED를 유지한다.
- **Studio T16 후속:** [후속 질문/첫 화면](docs/testing/studio-proposal-refinement.md)은 서버 부모 제안의 대상1블록 수정/추가→전체 미리보기→비공개28 저장/reload·동일 요청 복구를 실제 gpt-6-luna로 확인했다. Rill40그룹/634,513,000과 평균5.57USD, 비대상 정의/ID·원래25 보존,799.57초 실제 TTL400,390/768/1440 넘침0이다. 네이티브 선택창 방향키·편집기 run 링크 전체 실제 여정·운영/실휴대폰은 남아 있고 VoiceOver BLOCKED를 유지한다. 캡처는 Ego CDP 장애로 같은 Ego 창의 OS 캡처를 사용했다.

- 매 세션 시작·재개 시 이 요약과 현재 브랜치·변경 사항·선택 P 단계/UC/BR·작업에 필요한 파일만 먼저 확인한다. 전체 이력과 상세 설계 문서는 반복해서 읽지 않고 필요한 부분만 추가로 불러온다. 사용자의 최신 지시를 우선한다.
- DuckDB Measure·Dimension·탐색·Pivot·보기 저장의 기존 상태는 [Rill 통합 계획](docs/strategy/2026-10-14-rill-feature-integration.md)을 참고한다. 이 문서의 과거 다음 작업보다 제품 목표의 P1~P5를 우선한다. 탐색 화면은 Rill과 비교하고 대화/블록/게시 경험까지 Rill 화면으로 제한하지 않는다.
- Rill 공식 데모 데이터를 기준으로 기능과 UI를 항상 비교한다. 유사한 탐색 UI를 구현하고, 같은 조건의 수치·API/XHR·실제 화면으로 검증하며 미확인은 명시한다.
- 분석 UI는 [UI Kit](docs/design/analysis-ui-kit.md)의 토큰·국소 테마·공통 선택 버튼을 먼저 재사용한다. 부모 화면에서 버튼 최소 높이를 강제하거나 화면별 크기 예외를 중첩하지 않고 실제 크기·밀도·상태를 확인한다.
- UI 요소 추가·수정 전 [검증 스킬의 디자인·레이아웃 회귀 기준](skills/vanillameta-verify/SKILL.md#ui-컴포넌트-디자인레이아웃-회귀)을 적용한다. 작업 중과 완료 시 크기·높이·정렬·간격·레이아웃·폰트 및 주변 요소의 틀어짐을 실제 화면으로 확인하고 기능/디자인 결과를 분리한다.
- 지표·분석 요청의 의미와 UI/저장 상태를 특정 엔진의 SQL·드라이버 실행과 구분한다. 이 경계는 현재 변경 범위에서 유지한다.
- BigQuery·AWS Athena 연결은 고객 수요가 확인된 향후 단계로 미룬다. 미래 확장만을 위한 범용 엔진 프레임워크나 전면 리팩터링을 현재 완료 조건에 추가하지 않는다.
- 외부 엔진을 실제로 설계·구현할 때만 [외부 분석 엔진 도입 지침](docs/strategy/2026-10-14-rill-feature-integration.md#외부-분석-엔진-도입-지침--사용자-합의-2026-10-14)의 상세 기준을 확인한다.

- AI 생성의 저장 지표 재사용은 [UC-002](docs/use_cases/UC-002-reuse-saved-metric.md)를 따른다. 동일 소스의 활성 구조화 정의만 제공하고 명시 참조의 계산식은 기존 제작 계산기로 적용한다. Assistant 수정 모드의 차트 선택 시 저장 지표를 지정하면 서버가 해당 차트에만 계산식을 강제하고 미리보기에 재사용을 표시한다. 분석에는 SQL snapshot을 저장하며 live 참조·자동 이름 매칭 완전 보장은 후속 범위다.

- 저장 지표 계산식 변경은 [UC-003](docs/use_cases/UC-003-update-metric-calculation.md)을 따른다. Assistant에서 지표·차트를 명시 선택하고 변경 미리보기 후 두 버전을 확인하여 지표와 선택 분석을 atomic 저장한다. 기본 단일 저장은 다른 분석의 snapshot을 유지한다. 지표 버전은 양의 정수이며 기존 제작 링크의 선택 snapshot도 갱신한다.
- 같은 지표의 일괄 반영은 [UC-004](docs/use_cases/UC-004-batch-metric-update.md)를 따른다. 영향 확인 → 연결된 소유 분석 최대10개 선택 → 전체 미리보기 → atomic 저장이며 지표 버전은 한 번 증가한다. 명시 연결 없는 이전 분석은 자동 추측하지 않고, 계산식 저장으로 연결을 기록한다. 차트 배치와 미선택 분석은 유지한다.

## 로컬 실행

- **Backend**: `cd backend-api && npm run start:local` → http://localhost:4000 (SQLite `sqlite.db`, API prefix `/v1`)
- **Frontend**: `cd frontend-web && npm start` → http://localhost:3000
- **DB 시드**: `cd backend-api && npm run seed` — 멱등(`orIgnore`), component/databaseType/template/user 초기 데이터 삽입

## 테스트

- **Backend 유닛**: `cd backend-api && npm test` (test/ 하위 QTT 레거시 통합 스펙은 제외 — 실 DB 접속정보 필요)
- **Backend 빌드**: `npm run build` (nest build). `tsc --noEmit`은 test/ 픽스처 때문에 실패하므로 build 기준으로 검증
- **Frontend 유닛**: `cd frontend-web && npm run test` (vitest)
- **Frontend 타입/린트**: `npx tsc --noEmit`, `npx eslint src e2e`

## 변경 범위에 따른 검증

- 파일 저장/일반 수정마다 전체 테스트·빌드·E2E를 실행하지 않는다.
- 관련 단위/API → 기능 완료 시 변경 화면(현재 사용자 지정 Ego) → 통합 시 핵심 E2E → 출시 시 범위 확대 순으로 선택한다.
- 같은 코드/환경/픽스처에서 확인한 결과는 관련 변경이 없으면 재사용한다. 미실행은 통과로 보고하지 않는다.
- 상세 기준과 명령: [docs/testing/workflow.md](docs/testing/workflow.md).
- MD 시나리오/기대 결과: [docs/testing/cases.md](docs/testing/cases.md).
- 이 프로젝트 검증에는 `$vanillameta-verify`를 사용한다. 설치 전에는 [skills/vanillameta-verify/SKILL.md](skills/vanillameta-verify/SKILL.md)를 직접 읽는다.
- 기본 Playwright: `cd frontend-web && npm run test:e2e` (핵심 8개). 파일/`--grep` 선택으로 필요한 것만 실행한다.
- 격리 실행: `npm run test:e2e:isolated`. 확장 QA는 `npm run test:qa -- --grep '케이스 ID'`로 명시적으로 실행한다.
- UI 검증은 사용자 최신 지정 브라우저(현재 `ego-browser`) 실제 화면으로 수행하고 핵심/실패 캡처를 저장소 밖 증빙 폴더에 남긴다.

## 주의사항

- 비밀번호 정책: 대소문자+숫자+특수문자 8자 이상 (클라이언트에서 먼저 검증)
- react-alert 확인 다이얼로그: `DialogActions` 첫 버튼이 액션(확인/OK), 마지막이 Cancel — E2E에서 순서 주의
- `waitForURL`은 `\/widget` 같은 부분 매칭이 `/widget/create`에도 걸리므로 `$` 앵커 사용

## develop-v2 개발 검증

- 통합/출시 검증에서 루트 `npm run build`, `npm test`를 실행한다. 기능 개발 중에는 위 변경 범위 기준으로 선택한다. FE 타입은 `frontend-web`에서 `npx tsc --noEmit`.
- 기준 패키지 관리자는 npm. `pnpm-lock.yaml`은 이번 통합에서 갱신하지 않았으므로 pnpm 설치·배포는 미검증.
- `NODE_ENV=local` 백엔드는 `.env.local` → `.env.dev` 순으로 읽으며 명시한 셸 환경변수가 우선한다. Codex AI 연결은 추적하지 않는 `.env.local`에 설정한다. `SQLITE_PATH`, `FILE_UPLOAD_DIR`로 로컬 DB·업로드 경로를 분리할 수 있다.
- 자동 seed는 local 환경에서 사용자 테이블이 비어 있을 때만 실행한다. 기존 사용자가 있으면 초기화를 건너뛴다.
- Swagger JSON은 자동으로 추적 파일을 덮어쓰지 않는다. 내보내기가 필요하면 `SWAGGER_SPEC_PATH`에 출력 경로를 지정한다.
- Oracle/ODBC는 선택적 드라이버이며, 대상 OS의 네이티브 라이브러리 준비와 별도 연결 검증이 필요하다.

## 서버 파일 분석 MVP

- 신규 CSV/JSON/Parquet 저장은 서버 DuckDB worker_thread를 사용하며 메타데이터 DB와 기존 SQLite 소스는 유지한다.
- 단일 상시 Node 서버 + 영속 FILE_UPLOAD_DIR을 사용한다. 운영 설정/백업/미지원 범위는 `docs/strategy/server-duckdb-operations.md`, MD 검증은 `docs/testing/server-duckdb.md` 참조.
- 파일 선택 후 서버 저장은 바로 실행하고 브라우저 WASM 분석은 명시적 선택으로만 실행한다.

## AI 개발 검증 제공자

- 로컬 LLM(Ollama 등)은 사용하지 않는다. 로컬 코딩 에이전트(Codex 등)를 호출하며 현재 기본 지정 모델은 ChatGPT `gpt-6-luna`이다. `AI_PROVIDER=codex`는 기존 CLI 로그인 사용. 모델 지원/로그인 오류 시 다른 모델로 자동 대체하거나 성공으로 보고하지 않는다.
- 이 환경의 검증은 `AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, `AI_CODEX_MODEL_CATALOG=/Users/moonklabs/.codex/opencodex-catalog.json`을 함께 지정한다. 전역 설정을 제외한 CLI 호출에도 필요한 연결·카탈로그만 명시적으로 전달한다. 다른 호스트에서는 이 경로를 복사하지 말고 실제 설치 설정을 확인한다. 실행 예와 확인된 증빙은 `docs/testing/ai-dashboard.md` 참조.

## VanillaMeta GitHub 작업 계정

- 사용자 지정(2026-10-14): VanillaMeta의 GitHub 조회·커밋 push·PR 작업은 `drumcap` 계정을 사용한다.
- GitHub CLI 작업 전 활성 계정을 확인하고 필요하면 `gh auth switch --hostname github.com --user drumcap`으로 전환한다. Git의 인증 계정도 동일한지 확인한다.
- 커밋 작성자 이름·이메일은 GitHub 인증 계정과 별개이므로 기존 Git author 설정을 임의로 변경하지 않는다.

- **Studio 신규 ID 저장 복구:** [UC047/Ego93 후속](docs/testing/studio-save-new-block-recovery.md)은 임시 ID 복제/크기 변경 저장commit201뒤503→reload/자동POST0→정확한 동일 요청/같은idMap·서버ID·revision/최신GET→4블록reload·추가영수증0을 확인했다. 질문·모든폭배치·원본45 보존/46 정상원복·비공개게시0,390/768/1440넘침0·확인버튼32px, FE9/type/lint·실제38개 PASS다. 제품소스6911c634 불변/직전build재사용이며 확정후GET실패reload·409초안복귀 실제검증/운영·실기기·전체수용은 별도다.

- **Studio 확정 후 조회 복구:** [UC047/Ego94](docs/testing/studio-confirmed-read-recovery.md)는 동일 저장확인201→최신GET503한건→confirmed/문서/질문보존→reload/자동POST0→명시GET만→같은저장본/질문복구를 확인했다. 안내도 저장재실행 없이 조회만 설명한다. 영수증19/해당요청1·revision추가증가0·원본45불변/46내용원복·비공개게시0,390/768/1440넘침0/32px와 FE10/type/lint/build·실제43개 PASS다. 과거 확정후조회실패reload 미실행은 이 후속으로 보완하며409초안복귀 실제검증/반복장애·운영·실기기·전체수용은 별도다.

- **Studio 저장409 초안 복귀:** [UC047/Ego95](docs/testing/studio-save-conflict-return.md)는 미전달503/reload→다른탭 실제저장→정확한보관요청409/서버·기록불변→명시초안복귀/최신비교→같은제목내초안동의/전체미리보기→새저장/reload를 확인했다. 비대상최신제목·질문·ID/SQL/모든폭배치·원본45보존/46내용원복·비공개게시0,거절영수증0/명시최종저장1·390/768/1440넘침0/32px와 FE16/type/lint·실제52개 PASS다. 제품코드fde87ab3/build재사용이며 과거409실제미실행은 이 후속으로 보완한다. 반복경합/소스변경전체·운영·실기기·사람수용은 별도다.

- **최신 판정 우선:** [testing/status.md](docs/testing/status.md)의 2026-10-17 요약을 우선한다. UC047 Ego92~95가 신규ID/확정후조회실패reload/409초안복귀의 과거 미실행을 보완했다. UC007~010 표준절·다이어그램·TC005 step3/4 연결 후 strict 오류0/경고13/억제0이며 Draft·사람수용Open을 유지한다. 문서변경만으로 runtime을 반복하지 않는다. 다음 최우선은 고객 한업무질문·독립정답 파일럿이며 입력없는 합성자료 재검증/무한 장애조합으로 대체하지 않는다. 실기기/VoiceOver/운영gate는 별도다.

- **명세 경고 최신:** UC013~015의 대안 종료/재진입과 UC013/018 사용자 설명 정리 후 strict 오류0/경고2/억제0이다. 이전13경고 표기는70650b3b 당시 결과이며 [최신 요약](docs/testing/status.md)의 후속을 우선한다. FR011/NFR002 요구사항↔UC 상태집계 차이는 미해결로 남기고 상태/승인을 임의 변경하지 않는다. 제품코드/runtime 변경0·고객파일럿 입력대기 NOT_RUN이다.

- **Studio 소스 연결 후속:** [UC040 증빙](docs/testing/studio-source-connection.md)은 생성 성공한 sourceId의 profile/지표를 직접 확인해 두 번째 전체목록 GET 의존성을 제거한다. 검증 성공한 미등재 ID만 현재목록에 추가하고 profile 실패는 동일ID 명시재조회·질문보존/생성추가0이다. FE32/type/lint/build PASS·BE변경0이며 Ego96 로그인만료/신규계정생성 자동승인거절로 실제UI·3폭은 BLOCKED다. 사용자 계정생성승인 또는 기존계정 로그인 후 같은 공간에서 검증한다. 고객파일럿/전체수용PASS가 아니다.

- **Studio 새 생성 질문 복구:** [UC048 증빙](docs/testing/creation-question-recovery.md)은 미전송 질문·소스ID만 기존 로그인 scope/탭에24h/8KiB/2000자로 보관하고 권한 목록→명시 복구→소스 재확인으로 연결한다. 저장 확인/직접 링크 우선·자동POST0·실패 보존·저장 성공 정리/무관 기록 유지 회귀53개·type/lint PASS다. 기존32px 컴포넌트를 재사용했으며 Ego96 로그인 대기로 실제reload/390·768·1440 크기·정렬은 BLOCKED다. 실제UI·고객파일럿·전체수용을 완료로 보고하지 않는다.

- **UC048 다른 소스 후속:** [A3 증빙](docs/testing/creation-question-recovery.md#a3-다른-소스로-질문-이어가기--2026-10-17)은 다른 본인 소스 선택→별도 명시 질문복구→profile/지표 재확인→질문·새sourceId 보관이다. 선택만으로 기록 변경/자동POST0이며403은 원래 질문 보존·재선택/재시도한다. 회귀55개 PASS·기존32px 재사용, 실제Ego/모바일은 로그인 대기 BLOCKED다.
