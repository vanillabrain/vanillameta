# UC039 실제 브라우저의 늦은 조회·화면 이탈

2026-10-17, develop-v2 `8366b3f9`. UC039/TC039의 실제 브라우저 지연 응답·unmount 잔여 조건만 선택한다. 기존503 재시도/403·저장/게시·키보드 케이스는 재사용한다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| LATE-READ-01 | 실제 Studio GET200 응답 보류→브라우저 뒤로 화면 이탈→응답 해제, 현재 화면 보존 | PASS_SELECTED |
| LATE-READ-02 | 같은 흐름의 늦은503, 현재 화면에 이전 오류/편집기 노출 없음 | PASS_SELECTED |
| LATE-READ-03 | 대표390/1440 화면·가로 넘침·보류/해제 로그와 문서 불변 대조 | PASS_SELECTED |

별도 API4540/FE3440/프록시4541과 MYSQL05 복사 스키마 vm_backup_guard05를 사용한다. 인증 로그인/감사 기록 외 저장·게시 쓰기/새 AI 호출0을 목표로 한다. 원본 DB/기존 서버·AI 설정은 변경하지 않는다. 전송되는 실제 응답을 테스트 프록시에서 보류/교체하며 제품 동작으로 오류를 위장하지 않는다. 이번에는 unmount를 확인하며 같은 컴포넌트의 다른 대시보드 ID 전환/실휴대폰/VoiceOver 전체는 별도다.

## 실제 실행과 범위

Ego TaskSpace9 하나에서 기존 테스트 계정 로그인→Studio1 직접 조회→제품의 ‘기존 보기’ 링크를 클릭했다. 실제 브라우저에 만들어진 Studio1/기존 보기의 이력 entry를 `Page.navigateToHistoryEntry`로 뒤로/앞으로 이동했다. React 내부 상태/DOM/라우터를 주입하지 않았고 페이지 reload로 이전 요청을 취소하는 방식도 사용하지 않았다.

1. 프록시가 다음 `GET /v1/studio/dashboards/1`의 실제 upstream200 응답을 받은 뒤 보류했다. 브라우저는 ‘Studio를 준비하는 중입니다’를 표시했다.
2. 응답 대기 중 앞으로 이동해 `/dashboard/1`의 기존 보기로 떠났다. 기존 보기가635M(정확한 값 접근 레이블634513000)을 표시한 뒤 보류한200을 해제했다. 편집기가 다시 나타나거나 현재 경로/화면을 덮지 않았다.
3. 같은 이력에서 다음 Studio GET200을 다시 보류하고 기존 보기로 떠났다. 이번에는 해제 시 응답만503/명시 검증 문구로 교체했다. 현재 화면에 ‘Studio를 열지 못했습니다’ 또는 주입 문구가 나타나지 않았다.
4. 두 지연 응답 모두 프록시 해제 시 연결 destroyed=false, 브라우저 PerformanceResourceTiming의200/503·responseEnd>0을 확인했다. 단순히 요청이 취소돼 오류가 보이지 않은 경우로 판정하지 않았다. 실제 서버 장애/실제 권한 거절로 확대하지 않는다.

초기 서버를 짧은 부모 프로세스 아래 띄워 종료됐던 준비 오류는 유지되는 전용 실행 세션으로 해결했다. 기존 보기 링크의 도착을 `/dashboard` 목록으로 잘못 기대했던 wait timeout은 실제 `/dashboard/1` 상세로 교정했고, 보류 직전 상태 조회 race는 held=true 관찰 후 진행했다. 이 준비/기대 오류를 제품 FAIL이나 신규 수정으로 집계하지 않았다.

## 기능·디자인 증거

각 해제 후1440×1000/390×844 실제 캡처4개를 직접 확인했다. 현재 보기의 제목·수치/카드·도구가 유지되고 가로 넘침0이다. 모바일의 Studio 편집/공유/Assistant는 높이32px·글자14px이며 버튼 라벨이 읽히고 행 단위 줄바꿈된다. 이는 이번 상태의 선택 디자인 확인이며 모든 키보드/접근성/필터·오류 상태를 재검증한 것은 아니다. 축약635M은 기존 표시 설정이고 정확한634,513,000과 구분했다. 별도 Rill 재생성/AI 호출은 반복하지 않았다.

로그인/감사 정상 쓰기의 user/refresh_token/login_history를 제외한 **27개 테이블 전체 행/열·인덱스 지문 동일**:
`62a7582ad7eb8c40ea82b958cdbb4209d739883e86670838fa306c5d3e2a2478`.
저장·게시·분석 수정 POST0, 모델0. 요청 로그에는 로그인POST1건과 기존 보기의 읽기 전용 `/ai/dashboard-preview` POST6건이 있다. 이 미리보기는 저장/게시/LLM 생성 요청이 아니다. 나머지는 GET이다. 원본 DB/소스 내용·기존 서버는 변경하지 않았다. 파일 불변 전체 해시는 이번에 반복하지 않았으며 기존 MYSQL05/06 증빙과 구분한다.

외부 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-late-read-20261017`.
`success.json`, `error.json`, `browser-metrics.json`, `events.json`, `requests.json`, `before.json`, `after.json`, `result.json`, 비밀 없는 프록시 helper, `held-success.png`, `after-late-{success,error}-{1440,390}.png`를 보관했다. 원시 API 로그/비밀 설정·토큰은 포함하지 않았다.

제품 코드 변경0. 직전 통합8366b3f9의 단위/build/type 결과를 재사용하고 전체 테스트는 반복하지 않았다. 문서 링크·diff check만 추가 수행했다. 이번 Ego 공간/viewport·전용 API4540/FE3440/프록시4541은 종료한다. 문서 기록은 미커밋이다.

**잔여:** 같은 StudioEditor 인스턴스에서 서로 다른 정상 대시보드 ID로 전환하는 지연 성공/실패, 요청 취소·다른 인증 갱신과의 전체 경합, 실제 휴대폰·전체 키보드·운영/사람 수용은 NOT_RUN이다. React 내부 setState 호출 여부를 계측한 것은 아니며 사용자에게 보이는 화면 불변과 실제 응답 완료만 확인했다. gpt-6-luna/VoiceOver BLOCKED 유지.

## 두 정상 대시보드 ID 전환 계획 — 2026-10-17

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| ROUTE-READ-01 | A의 실제 GET200을 지연하고 B Studio로 같은 문서 내 이동, B의 제목/ID/수치가 유지됨 | PASS_SELECTED |
| ROUTE-READ-02 | 같은 흐름의 A 늦은503이 B 정상 Studio를 오류로 덮지 않음 | PASS_SELECTED |
| ROUTE-READ-03 | 390/1440 대표 상태·보류 응답 완료·저장/게시 무변경 대조 | PASS_SELECTED |

별도 MySQL vm_route_read08에 기존 정상 로컬 백업을 준비하고 두 번째 대시보드와 소유/위젯 연결을 검증 fixture로만 추가한다. 기존 스키마/원본은 수정하지 않는다. fixture 준비 쓰기는 별도 집계하며 검증 중에는 로그인/감사 외 저장·게시·LLM 쓰기0을 기대한다. 두 Studio 사이의 실제 browser history 전환을 사용하고 앱 내부 상태를 주입하지 않는다. 단순 다른 페이지 이탈은 위 LATE-READ 결과로 재사용한다.

### ROUTE-READ 실제 결과

**ROUTE-READ-01~03 PASS_SELECTED.** 전용 API4550/프록시4551/FE3450/Ego10 하나에서 수행했다. 원본 MYSQL03 백업을 새 vm_route_read08에 준비하고 dashboard2(제목 `조회 전환 대상 B`)·user_mapping1개·dashboard_widget1개를 fixture로 추가했다. 기존 dataset/widget/source는 같은 공개 Rill 샘플을 읽는다. 이는 제품 복제 기능 실행/검증이 아니며 준비 쓰기를 검증 중 쓰기0과 섞지 않는다. B shareId는 null이고 게시를 만들지 않았다.

실제 제품 링크를 Enter로 열어 목록→A 보기→A Studio→A 보기→목록→B 보기→B Studio 순으로 같은 브라우저 문서의 history를 만들었다. 최초 목록 포인터 클릭은 탐색을 끝내지 못해 현재 snapshot 확인 후 Enter로 진행했다. A Studio의 제목은 h1/h2가 중복되므로 단일 heading 선택자 오류는 실제 수치/기존 보기 링크 관찰로 교정했다. 준비 도구 오류를 제품 실패/수정으로 집계하지 않았다.

B Studio에서 실제 history entry146(A)로 이동해 A GET을 보류했다. loading을 확인한 뒤 entry150(B)로 직접 전환했고, 실제 B GET200·제목·수치가 나타난 뒤 A 응답을 해제했다. 별도 두 번째 흐름에서는 A의 upstream200을 해제 시503으로만 치환했다. 두 번 모두 **B의 `/dashboard/2/studio`·제목·기존 보기 `/dashboard/2`·634,513,000 유지, A 제목/이전 오류 노출0**이었다.

브라우저의 navigation entry1개/timeOrigin이 두 흐름 내내 동일했다. React Router의 같은 `/dashboard/:dashboardId/studio` 경로 간 직접 history 전환이며, 중간 다른 페이지/unmount 또는 reload로 회피하지 않았다. DOM MutationObserver는 loading→B 제목만 기록하고 A 제목/오류를 기록하지 않았다. 관찰용 임시 window 변수/observer는 각 흐름 뒤 제거했다. React fiber/비공개 상태를 읽거나 setState를 직접 호출하지 않았다. 같은 route element의 ID 변경은 source/route 구성과 브라우저 history로 대조했으며 React 내부 인스턴스 ID를 계측한 것은 아니다.

프록시의 두 해제는 connectionDestroyed=false였다. 브라우저 완료 응답은 A200/200/503, B200/200/200(responseEnd>0)이다. 최초 A/B 정상 준비 조회까지 포함한 횟수이며, 지연된 A 응답 두 건이 실제로 도착했음을 분리 확인했다. API 요청 로그에는 로그인과 읽기 전용 preview를 제외한 저장/게시/LLM 호출이 없다.

### ROUTE-READ 디자인·정합성

1440×1000/390×844에서 B의 제목·도구·KPI 캡처를 직접 확인했다. 배치 완료 후 가로 넘침0, 모바일 게시·공유/저장/AI 열기 높이36px·글자14px, 기존 보기32px/14px다. 헤더와 본문은 모바일에서 줄바꿈되고 KPI 값은 아래로 스크롤해 별도 캡처했다. 기존 링크 Enter 탐색 외 전체 키보드/스크린리더는 재검증하지 않았다.

첫1440→390 전환 직후에는 이전 데스크톱 배치의1018px 넘침이 측정됐다. 캡처 시점과 다음 DOM 확인에서는 모바일 배치/scrollWidth390이었고, 이후 배치 완료 조건과 frame 경과 뒤 측정한 두 폭은0이다. 최초 관찰은 `success.json`에 보존하고 `success-settled.json`과 구분했다. 즉시 resize의 모든 중간 frame에 넘침이 없다는 보장은 하지 않는다. 제품 코드 수정은 하지 않았다.

로그인/감사의 user/refresh_token/login_history를 제외한 **26개 테이블**의 fixture 후/검증 후 행·열/인덱스 지문이 같다:
`ff9f2c19fa37edcbed85b7a7c9bd9a7cd4e83281ce098eee38fc8d7c45450af1`.
기존 LATE-READ의27개와 달리 이번 새 스키마에는 백업 검사 probe 테이블을 추가하지 않았다. A/B 문서·위젯/매핑·영수증 불변, 검증 중 저장·게시·LLM0이다. 파일 전체 해시는 반복하지 않았다. 같은 Rill 정답을 재사용하며 Rill UI/생성을 재실행하지 않았다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-route-read-20261017`의 fixture/before/after/result·success/success-settled/error·document-before/browser-metrics·events/requests JSON, 비밀 없는 fixture/proxy/fingerprint helper, `late-{success,error}-B-{1440,390}` 및 settled/value 캡처. 원시 API 로그·QA 비밀번호·키·토큰은 저장소/증빙에 복사하지 않았다.

Ego10/viewport·전용 API4550/FE3450/프록시4551은 종료했다. 새 로컬 fixture 스키마는 비공개로 보존하고 기존 스키마/서버는 변경하지 않았다. 앱 코드 변경0으로 직전 단위/build/type 결과를 재사용했고 문서 diff/링크만 검사했다. 이번 기록과 앞선 unmount 기록은 미커밋이다.

**최신 잔여:** 양쪽에 미저장 초안이 있거나 인증 갱신/취소가 겹치는 모든 경합 조합, 실제 휴대폰·VoiceOver·운영 부하/사람 전체 수용은 미검증이다. 위 최초 잔여 중 두 정상 ID의 선택 지연 성공/실패 조건만 해소한다. gpt-6-luna/VoiceOver BLOCKED 유지.
