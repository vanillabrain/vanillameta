# UC-020 저장 대시보드 복제·소스 교체 검증

2026-10-15, `d5d328e8` 위 UC-020 변경. P5/FR-012 첫 단위이며 [UC](../use_cases/UC-020-reuse-dashboard.md)·[설계](../architecture/dashboard-reuse.md)·[TC](../test_cases/TC-020-reuse-dashboard.md)를 먼저 작성했다. 별도 native executor가 열 연결 구현, SQLite 원자 저장 검사, 설계/코드 리뷰를 분담했고 Main이 통합·실제 화면을 검증했다. 문서는 Draft이며 사람 승인·운영 배포·전체 P5/TC-005 수용은 별도다.

## 구현 범위

소유 저장 화면의 **복제해서 재사용 → 제목/소스/열 연결 → 전체 미리보기 → 복사본 저장**이다. 정확한 이름·호환 타입만 자동 연결하고 다른 이름은 직접 선택한다. 열 연결 설정은 기본 접힘이며 누락 시 펼친다. 새 페이지는 공통 shadcn 컴포넌트를 사용한다. 미리보기와 저장본은 숫자+시계열·차트를 유지한다.

서버는 임의 SQL/draft를 저장 입력으로 받지 않는다. 원본과 대상 소스의 권한·revision을 검사한 5분 ticket에 전체 검증 결과를 묶는다. 저장은 새 대시보드·블록 ID·비공개 소유 관계와 영수증을 한 transaction에 기록한다. 같은 요청은 기존 복사본을 반환하며 원본·지표 링크·게시·저장 보기를 가져오지 않는다. 계산식 snapshot과 모든 폭의 논리 배치를 새 ID에 연결한다. DB 스키마·새 의존성은 없다.

## 자동 검증

| 실행                                                                                      | 결과 / 증거 범위                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend-api`: `npx jest src/bi/dashboard-remap.spec.ts`                                  | 15 PASS. 필요한 열·타입·alias/문자열/CAST·출력 필드 보존, 누락·모호한 SQL·미지원 거절                                                                                   |
| `backend-api`: `npx jest src/bi/dashboard-reuse.service.spec.ts`                          | 10 PASS. 실제 SQLite 엔티티와 저장기로 쓰기 없는 preview·권한/revision·새 ID/배치/비공개·원본/게시 불변·부분 실패 rollback·동시/만료 후 같은 요청 재확인·다른 요청 차단 |
| `frontend-web`: `npx vitest run src/pages/Dashboard/DashboardReuse src/pages/Publication` | 3파일 29 PASS. 재사용 UI 8개 및 게시 회귀. ticket만 저장, 입력 변경 무효화, 묵은 응답 무시, 실패 입력 보존, 불명확한 저장 잠금/같은 요청 재시도,409,잘못된 결과 ID      |
| BE 변경 6파일 ESLint; FE 변경 파일 ESLint·`npx tsc --noEmit`                              | PASS                                                                                                                                                                    |
| 루트 `npm test`                                                                           | BE 93 suites / 1,642 tests, FE 65 files / 990 tests PASS                                                                                                                |
| 루트 `npm run build`                                                                      | Nest/Vite PASS                                                                                                                                                          |

루트 테스트·빌드는 설치된 Node24.19.0을 PATH로 지정했다. 실제 로컬 API는 기존 Node22.23.1 환경을 유지했다. SQLite 검사에서 preview/소스 profile은 테스트 대역이며 실제 파일 집계는 아래 Ego/API 실행으로 별도 확인했다. 핵심 Playwright 전체 E2E는 이번에 실행하지 않았다.

## Ego 실제 기능 / XHR

TaskSpace39, FE3698/API4899→4898, 기존 로컬 DB `/tmp/vm-rill-views/metadata.db`와 DuckDB 업로드를 사용했다. 공개 Rill 데모 원본 분석12/소스7을 읽고 열 이름이 다른 별도 Parquet 소스로 교체했다. 화면의 클릭·입력·선택으로 진행했으며 저장은 UI의 실제 POST였다.

1. 원본의 복제 링크 진입, 동일 소스 열4개 자동 연결을 확인했다. 비호환 소스24는0/4 연결·미리보기/저장 비활성 안내를 표시했다.
2. 공식 데모 Parquet의 첫2,000행을 별도 파일로 만들고 요청 수를2배로 바꿨다. 소스23에서 `bid_request_cnt→requests_new`, `bid_floor→floor_new`, `has_bid_floor_cnt→floor_count_new`, `device_os→os_new`를 직접 연결했다.
3. 전체 미리보기 POST201: 요청 수 **1,776,800**, 평균 Bid Floor **3.5034561451116626**, OS17그룹 합계1,776,800. 두 숫자 카드의 시간별 추세25점과 막대 차트를 확인했다. 독립 DuckDB oracle과 일치한다. 원본 compact/소수0 표시는 보존되어 요청 수 화면은 **2M**, 평균은 **$3.50**이며 정확한 원값은 데이터 표/접근성 정보에 있다.
4. 복사본 저장 POST201 → **분석23 `Rill 소스 교체 재사용 검증`**. 새로고침 후 editor/analysis/publication 응답이 저장 직후와 동일했다. 원본12의 editor·정의·revision·게시 응답은 작업 전후 완전히 동일했다.
5. 3개의 영구 block ID가 모두 새로 발급되고 mobile/tablet/desktop 좌표와 표시 형식은 순서별 동일했다. 복사본은 source23, structuredDefinition=null, shareYn=N, publication=null/version0이다.
6. 같은 ticket/requestId를 실제 API로 재전송해201 `{id:23,replayed:true}`를 받았다. 저장 전후 DB 증가는 dashboard1/widget3/dataset3/private share1/receipt1이며 metric과 publication 증가는0이다. UI 응답 유실 주입은 하지 않았고 동일 요청 복구의 FE/SQLite 검사와 실제 API 재확인을 구별한다.

검증용 복사본23과 소스23/24는 로컬 비공개 fixture로 보존했다. 원본·기존 사용자 데이터는 수정/삭제하지 않았다. preview ticket은 만료되지만 이미 저장한 요청의 영수증 재확인은 유지된다.

## 디자인·정렬 / Rill 비교

390/768/1440px에서 진입·미리보기·저장 화면을 캡처하고 실측했다. 새 복제 링크32px/14px, 재사용 페이지 주요 버튼36px, 입력/선택36px이며 모바일 입력16px·데스크톱14px다. 같은 행의 입력 높이/상단, 버튼 간격과 모바일 세로 쌓기, 비활성/누락 안내를 확인했다. 최종 대표 화면 가로 넘침은 모두0이다. 빠른 폭 변경 직후 한 번 측정된 넘침은 안정 프레임 검사에서 재현되지 않았다. 390px에서45프레임 연속으로 가로 넘침0 및 경계를 확인했다. 모든 로딩/오류 상태의 폭별 실제 화면 조합은 미검증이다.

실행 중 Rill9009의 요청635M·평균$5.57, 숫자+작은 추세·OS 차원 분포 화면을 함께 확인했다. Rill은 전체 데모이며 이번 교체 파일은2,000행/요청2배이므로 같은 수치라고 비교하지 않는다. Rill의 이동된 날짜(2026-10-06~13 PDT)와 원본 Parquet 날짜(2023-09-09~16 UTC)도 다르다. 새 소스 결과의 정답은 위 동일 파일·동일 SQL DuckDB oracle로 검증했다. Rill에서 소스 교체/복제 기능 자체를 실행하거나 동일 시간 bucket 수치까지 대조한 것은 아니다.

## 증빙 / 남은 경계

저장소 밖 `/tmp/vm-dashboard-reuse/`에 `summary.json`, `original-before/after-save.json`, `copy-saved/reloaded.json`, `saved-events.json`, `replay.json`, `oracle.json`, DB 전후 개수, `final-preview-*`, `saved-stable-*`, `saved-mobile-stability.json`, `incompatible-390.png`, `rill-reference.png`와 검사 로그를 남겼다. 임시 파일의 영구 보존은 보장하지 않는다. `.aiwf/evidence/UC-020`에는 검사 로그/요약을 복사하고 packet은 awaiting_review·acceptance not_recorded로 유지한다.

AIWF strict lint의 기존 오류12/warning34/info4는 남아 있으며 UC020 파일 새 진단은 없다. pin/check는 내용 drift 증거이며 의미 승인이나 제품 완료가 아니다. FR-012·용어는 기존 요구를 유지하고 UC/TC/설계·계획/엔티티의 영수증 재사용만 동기화했다. 별도 스택 coverage-check는 없으므로 위 직접 코드/검사 대조 범위만 주장한다.

운영 MySQL 잠금/재시도·다른 생성 흐름과의 SQLite 동시 경합·실휴대폰·커머스 의미/데이터·공유 수신자 remix/게시본 복제·외부 DB·임의 SQL·질문으로 복제·복사본 게시·전체 P5/TC-005는 미검증/후속이다. 구형 분석에 desktop 배치가 없으면 기존 편집기 저장이 먼저 필요하다. 영구 미저장 초안·서버 재시작 후 미저장 ticket 복구는 지원하지 않는다.
