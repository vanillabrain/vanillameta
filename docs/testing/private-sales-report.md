# U1 고정 비공개 매출 보고서 검증

2026-10-29. [계획](../plans/private-sales-report.md). develop `f65fe50b` 이후 보고서 작업 트리다. 기존 허브 PASS는 재사용했다. 새 오류 HUB-FIN-09는 [허브 후속](artifact-hub-completion.md)에 있다. 운영 배포나 전체 기능 수용 결과가 아니다.

| ID | 새 조건과 실제 결과 | 상태 |
|---|---|---|
| RPT-01 | 표준37주문 저장 Studio에서 수동 본문·KPI·채널 차트를 선택했다. CSV Decimal 정답16,537.01 USD 및 채널5개와 서버 결과가 일치했다. | 실제 API·Ego PASS |
| RPT-02 | 키보드 저장으로 보고서 `7b5d8989-0271-47cb-b4d4-bcc8fe39004a` r1을 만들었다. 목록→재열기→reload에서 본문·수치·기준·revision이 같았다. | 실제 API·Ego PASS |
| RPT-03 | 원본 교체 후 본문만 보완한 r2는 r1 snapshot과 완전히 같다. 별도 API 검증 보고서에서 명시 미리보기·capture 저장만20,237.01로 바뀌며 과거 r1 outcome은16,537.01을 유지했다. | 실제 API·Ego PASS |
| RPT-04 | 같은 스키마37행에서 각 행의 net_amount에100을 더한 Parquet를 제품 파일 교체 API로 적용했다. 동적 Studio는20,237.01, 기존 두 보고서는 저장값을 유지했다. 읽기·retain의 집계0은 native DuckDB 서비스 테스트로 확인했다. MySQL 실행 중 DuckDB 호출 추적은 별도다. | 선택 범위 PASS |
| RPT-05 | 정상 제어 API로 PID57387→82674를 확인했다. 최종 빌드 반영 후에도 별도 새 PID와 r2 전체 동일성을 확인했다. MySQL 컨테이너를 재시작한 결과는 아니다. | 실제 API PASS |
| RPT-06 | 실제 저장 응답을 유실시킨 뒤 reload는 outcome만 확인했다. 결과 조회 GET503에서도 정확한 티켓을 유지하고 재조회로 복구했다. 같은 UUID replay는 과거 결과를 반환하면서 최신 head를 되돌리지 않았다. 동시 동일 CAS 저장은201 한 건·409 한 건이었다. | 실제 API·Ego PASS |
| RPT-07 | 다른 조직 소유자의 read/preview/save/outcome 네 경로403·목록0개, 소스 비활성403·KPI/본문 비노출·재활성 복구를 확인했다. 다른 탭에서 계정을 전환한 뒤 이전 계정의 지연 목록 응답을 풀어도 제목이 표시되지 않았다. epoch·집계 중 변경은 서비스 선택 검사다. 모든 MySQL writer 잠금 경합은 미실행이다. | 선택 범위 PASS |
| RPT-08 | 실제 HTTP에서 datas/SQL/초과 본문/잘못된 선택400과 오래된 preview409를 확인했다. MySQL에60,000bytes Unicode 본문을 저장하고3개 chunk의 순서·bytes·hash·재조립 본문을 대조했다. 격리 MySQL8.4.11 migration UP 두 번과 내부 RESTRICT 관계를 확인했다. 최대2MiB·20MiB·손상 거절은 단위 검사 범위다. | 선택 범위 PASS |
| RPT-09 | 실제1800×849 데스크톱에서 본문→Tab→저장 버튼 초점·Meta+Enter 저장·목록 링크 Enter·재열기·권한 복구 후 키보드 재조회를 확인했다. 입력/주요 버튼40px, 입력16px, 가로 넘침0이다. 전체 키보드 접근성 인증은 아니다. | 실제 Ego PASS |

## 실제 환경과 수치

증빙 폴더는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/private-sales-report-20261029`다. 새 소유 MySQL8.4.11/API4270/WEB3270/CONTROL4470·Ego94를 사용했다. 처음 빌드 경로가 이전 remote OAuth 출력으로 고정된 검증 환경을 발견해 정상 stop200·소유 컨테이너 제거·runRoot 제거 후 교체했다. 보고서 검증은 별도 `backend-api/.scratch/private-report-dist`에 복사한 현재 Nest 빌드에서 실행했다. 이전 실패 소유22e26a 환경은 건드리지 않았다.

표준 Analytics Engineering 합성 데이터37주문, USD·UTC·주문일 코호트를 사용했다. 독립 CSV Decimal 합산은 organic5,954.96, paid_social4,548.95, referral2,596.72, paid_search1,994.30, affiliate1,442.08이다. 합계는16,537.01이다. Figma의 예시 KRW 수치를 사용하지 않았다. 새 소스·지표·Studio 준비는 fixture이며 AI 생성 성공으로 세지 않는다.

`root-baseline.json`과 `root-after-api.json`에서 보고서 생성·본문 변경·재시도·충돌·거절 전후 원본9개 테이블의 행 수와 hash가 같았다. 이후 명시 파일 교체와 소스 비활성/복구의 fixture 변경은 이 불변 비교에 포함하지 않는다. 보고서 저장 자체는 새 grant·게시·공유 관계를 만들지 않는다.

## 발견해 수정한 오류

- 목록 재조회가 진행 중 샘플 준비 컴포넌트를 교체하는 허브 오류를 수정하고 커밋에 포함했다.
- 보고서 UI가 계정 변경 뒤 오래된 응답을 표시할 수 있어 계정/세션·route별 workspace와 응답 검사를 적용했다. 새 보고서 UUID도 route별로 분리했다.
- 저장 결과 열기에서 최신 GET이 성공하기 전에 요청 티켓을 지우던 오류를 수정했다. 과거 replay 결과도 최신 head와 구분한다.
- 기존 보고서 GET403을 빈 작성 화면과 '초안을 유지했습니다'로 표시하던 안내를 수정했다. 이제 조회 실패·현재 권한/소스 상태·다시 불러오기를 표시하며 초기 폼을 숨긴다. 첫 재캡처가 로딩 중 상태였음을 확인해 실제 alert가 나타난 뒤 다시 캡처했다.

독립 최종 코드 검토에서 해당 수정의 추가 차단 문제는 발견하지 않았다. 계정 전환이 preview/save 중에 일어나는 모든 변형과 replay 후 최신 GET 실패의 실제 브라우저 조합은 이번 범위에서 실행하지 않았다.

## 실행 증빙

| 종류 | 파일 |
|---|---|
| 숫자 정답·fixture | `csv-decimal-oracle.json`, `studio-fixture.json` |
| API·동시 CAS·입력 거절 | `verify-api.cjs`, `api-boundary-results.json`, `access-and-unicode-results.json` |
| 고정 r1/r2·원본 교체·명시 새 기준 | `ui-report-r1.json`, `ui-report-r2.json`, `source-refresh-invariance.json`, `explicit-recapture.json` |
| 실제 API 재시작 | `api-restart-invariance.json`, `final-api-restart.json` |
| migration·Unicode MySQL | `mysql-migration.json`, `mysql-unicode-chunks.json` |
| 단위·빌드 | `owner-verification-extract.json`, `frontend-final-build.log`, `backend-build-final-manifest.json` |
| 화면 | `report-final-desktop.png`, `report-list.png`, `report-keyboard-save.png`, `report-lost-response-recovery.png`, `report-recovery-read-failed.png`, `report-account-switch.png`, `report-source-disabled-after-fix.png` |
| 실제 정렬·오류 상태 | `desktop-layout.json`, `permission-ui-after-fix.json` |

구현 담당 실행 기록에서 새 보고서 BE 고유17개·영향받은 publication4개를 확인했다. 초기 모듈 DI 테스트 실패 후 09:33:56Z의 최종 PASS도 원 실행 기록에서 확인해 추출에 포함했다. FE 첫11개와 후속 최종23개는 겹치는 배치이므로 합산하지 않는다. 마지막23개·타입·대상 lint와 FE 최종 빌드가 통과했다. BE Nest 최종 빌드를 실제 API에 반영했다. 기존 PASS 전체나 전체 Playwright suite는 반복 실행하지 않았다. Vite의 기존 SVG 중복 dynamic import 경고는 남는다.

실행 추출은 해당 작업의 두 하위 세션에서 검증 요약만 읽었다. 다른 프로젝트 기록·테스트 인증정보는 증빙에 넣지 않았다. 검증 스크립트는 매 실행 테스트 생성 대신 이번 MD 조건을 재현하는 보조 자료이며 자격증명은 `/private/tmp`의 이번 격리 계정 파일에서만 읽었다.

## 제품 범위와 남은 조건

본문은 일반 텍스트다. U1은 본인 소유의 저장 Studio와 본인 소유 DuckDB 소스, 숫자 KPI 하나와 bar/column/line 차트 하나를 지원한다. Legacy 임의 SQL·Pivot·여러 소스·공유 소스·리치텍스트·이미지·AI 본문·공유·게시·보고서 삭제·화면의 전체 이력 선택은 이번 구현에 포함하지 않는다. 과거 revision은 불변 저장하고 원래 request outcome으로 확인한다. 기본 보고서 GET은 현재 head를 읽는다.

모바일 제외. gpt-6-luna 설정 유지. 수동 본문 단위이므로 제품 모델 호출은0이며 AI 생성 성공을 주장하지 않는다. VoiceOver BLOCKED 유지. 운영 migration·운영 배포·다중 서버 전체 경합·다크 테마 수용·전체 기능 완료는 별도다.

## 검증 환경 종료와 Git 경계

현재 소유 런타임의 관측 오류0·그룹0을 확인한 뒤 인증된 `/stop`으로200을 받았다. supervisor가 소유 컨테이너 제거·임시 인증정보 제거를 확인했고 runtime은 stopped다. Ego94는 `finish({keep:[]})`로 종료했다. 이번 임시 계정 파일·교체 파일·전용 빌드·런타임 복사본만 정리했다. `runtime-cleanup.json`에 결과를 남겼다. 기존 실패 소유22e26a 환경은 보존했다.

허브19파일은 drumcap으로 develop `f65fe50b`에 커밋·push했다. 새 보고서 구현과 이 검증 기록은 별도 미커밋 변경으로 남긴다. 기존 사용자 설정과 별도 설계 파일은 변경·커밋 대상에서 제외했다. 검증용 MySQL을 정리했으므로 캡처의 테스트 보고서 URL은 실행 중인 데모 링크가 아니다.
