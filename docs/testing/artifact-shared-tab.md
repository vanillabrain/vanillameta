# 아티팩트 허브 공유받음 탭

2026-10-31. 기준 브랜치 `develop`. 이번 작업은 통합 목록 2번 묶음의 첫 구현 단위다.

## 범위

- 허브에 `내 아티팩트`와 `공유받음` 두 범위를 두었다. 기존 보관함·목록/그리드·검색은 내 아티팩트 범위에만 남는다.
- 공유받음은 두 소스를 합친다. `GET /v1/reports/library`에서 `ownership: received`인 보고서와 `GET /v1/enterprise/deliveries/dashboard/received`의 받은 분석이다.
- 받은 행은 읽기 전용 링크만 제공한다. 받은 분석은 `/dashboard/:id`, 받은 보고서는 `/reports/:id/read`로 이동한다.
- 공유받음에서는 새 대시보드 추가, 파일 업로드, 보관, 삭제, 상태 탭을 숨긴다. 수신자에게 원본 소스 권한을 새로 주지 않는다.
- 받은 분석 목록은 20개 커서를 그대로 쓰고, `받은 자료 더 불러오기`로 다음 페이지를 이어 붙인다.
- 원본 공유 회수·만료는 이 화면이 만들지 않는다. 목록은 현재 서버가 허용한 항목만 투영한다.

## VERIFIED

| Check | Result | Evidence |
| --- | --- | --- |
| 받은 보고서·받은 분석 링크 | `공유 보고서`는 `/reports/<id>/read`, `공유 대시보드`는 `/dashboard/9`로 렌더 | `src/pages/Dashboard/ArtifactLibrary.test.tsx` |
| 읽기 전용 | 공유받음 범위에서 삭제 버튼이 없고 `onDelete`가 호출되지 않음 | 같은 파일 |
| 기존 허브 회귀 | 검색·유형·정렬·그리드·보관·보고서 혼합 목록 유지 | `ArtifactLibrary.test.tsx`, `src/pages/Reports` 5 files 58 PASS |
| 정적 검사 | typecheck, eslint, production build PASS | 명령 출력 |

## BLOCKED

- 실제 브라우저 390/768/1440과 HTTP 왕복. 이 세션 샌드박스가 `listen`에 EPERM을 돌려주고 승인 심사가 시간 초과됐다. 화면 캡처 증빙은 아직 없다.
- 공유 회수·만료 뒤 목록에서 사라지는지의 실제 API 확인. 서버를 띄울 수 있는 환경에서 받은 보고서·받은 분석 각각 1건을 공유하고 회수·만료 후 재조회해야 한다.
- `src/pages/Dashboard/index.test.tsx`는 이 변경 전부터 12개가 실패한다. 첫 실패는 허브가 `/documents`·`/artifacts/files`를 조회하는데 테스트가 `/dashboard/library`만 기대해서 생긴다. 이번 범위에서 고치지 않았고 PASS로 세지 않는다.

## 다음 확인

1. 받은 보고서 공유를 만들고 수신자로 로그인해 공유받음 탭에서 열기.
2. 원본 공유를 회수한 뒤 목록이 비는지, 이미 받은 보고서 열람이 403인지.
3. 만료 시각이 지난 파일 공유 링크가 404인지.

