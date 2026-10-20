# UC-020 대시보드 복제·소스 교체

P5/FR-012의 첫 단위, Draft. 설계 착수 시 블록 복제만 있었고 대시보드 전체 복제·소스 교체가 없었다. 이번 구현은 아래 경계를 추가했다. 기존 편집기는 원본 소스를 고정하며 이번 기능은 원본 수정과 분리된 복제 초안이다.

## 경계와 최소 변경

소유 대시보드에서 `/dashboard/:id/reuse`를 연다. 서버가 원본 정의·프로필·사용 열·배치를 읽고 화면은 대상 소스·열 연결·새 제목만 제출한다. raw SQL·임의 draft를 저장 API 입력으로 받지 않는다. 정확한 열 이름과 타입만 자동 연결하고 다른 이름은 명시 선택한다. 기존 제한 SELECT 토큰 문법 안에서 source 열 식별자만 바꾸며 문자열·출력 alias를 보존한다. 해석이 모호한 식은 거절한다. 기존 source SQL guard·preview compiler가 새 소스에서 전체 결과를 검증한다.

`GET /bi/dashboards/:id/reuse`는 복제 초안 정보를 반환한다. `POST .../reuse/preview`는 expectedRevision/sourceId/sourceRevision/title/columnMap만 받는다. 미리보기용 임시 block ID와 기존 모든 폭 배치를 연결하고 전체 미리보기 및 만료 ticket을 반환한다. `POST .../reuse`는 ticket/requestId만 받는다. ticket은 5분/100개/계획당128KiB로 제한하고 owner·원본·대상 revision·정의/배치에 묶는다. 원본과 target 프로필·권한이 유효해야 하며 원본 게시 읽기 권한만으로는 복제를 허용하지 않는다.

저장은 기존 AiDashboardService.save·생성 영수증·transaction/SQLite 직렬화를 재사용한다. 원본과 소스 버전을 저장 전후 transaction 안에서 검사하고 실패하면 rollback한다. 한 ticket은 첫 requestId에 묶고 다른 requestId로 중복 저장하지 못한다. 같은 requestId 재시도는 영수증을 먼저 확인해 만료 후에도 기존 복사본만 반환한다. 새 미리보기마다 FE는 새 requestId를 발급한다. 영구 block ID는 저장기가 새로 발급하고 순서별 layoutEdits로 같은 좌표를 연결한다. 새 저장의 structured metric 링크는 비워 원본 지표를 가져오지 않는다. 새 공유는 N이며 publication은 만들지 않는다. DB 스키마·새 의존성은 추가하지 않는다.

FE는 source/열/제목 변경 시 기존 미리보기·ticket을 무효화하고 sequence/abort로 이전 응답을 무시한다. 네트워크 저장 실패 시 초안과 같은 requestId를 유지해 같은 저장을 재시도한다. 결과가 불명확한 동안 입력을 잠가 서로 다른 저장을 만들지 않는다. 정상/오류/취소와 원본·복사본 링크를 단순한 단계로 표시한다.

## 검증과 종료

원본/target 권한·버전·미지원 SQL·열 누락/타입·alias/문자열 보존·전체 rollback·영수증 중복 방지·배치/ID 분리를 자동 검사한다. FE는 소스 변경 시 preview 무효화·묵은 응답·실패 보존을 검사한다. Ego의 공개 Rill 데이터 원본으로 복제→다른 파일 소스/열 연결→미리보기→저장→reload와 390/768/1440px를 확인한다. 원본·게시 상태 불변, 새 소스 oracle, 복사본 ID·비공개 상태를 재조회한다.

공유 수신자의 remix·게시본에서 복제·외부 DB·임의 SQL·지표 자동 생성/이름 추측·복사본 재게시·영구 초안은 후속이다. 전체 P5/TC-005 수용으로 승격하지 않는다.

## 구현·검증 기록

[실행 증거](../testing/dashboard-reuse.md)에 코드/SQLite/실제 Ego 범위와 남은 경계를 기록했다. 기존 생성 영수증을 별도 digest namespace로 재사용하며 새 스키마는 없다. 운영 DB·다른 생성 흐름과의 SQLite 동시 경합은 미검증이다.
