# 통합 Artifact와 파일형 자산

2026-10-31. H04/F01-F03 구현 계약. 기존 Dashboard·보고서·Google 문서 권한을 하나의 공유 테이블로 합치지 않는다. 허브는 각 자산의 기존 읽기 결과를 정규화해 보여 주고, HTML·PDF·PPTX만 새 소유권·버전 모델을 사용한다.

## 데이터 형태

파일 자산은 `artifact_file`과 `artifact_file_version` 두 테이블로 분리한다. 현재 버전은 `artifact_file.headVersion`이며 이전 버전은 삭제하지 않는다.

- `kind`: `html`, `pdf`, `pptx`
- `title`: 최대 200자, 최초 업로드 파일명에서 확장자를 제거한 값
- `headVersion`: 1부터 증가
- `revision`: 제목·공유·삭제 상태 변경 CAS
- 버전: 원본 파일명, 검증된 MIME, 확장자, bytes, SHA-256, 저장 키, 생성 시각
- 소유권: `ownerId`, 선택적 `organizationId`; 현재는 소유자 인증 읽기/수정
- 공유: 추측 불가능한 32-byte token의 SHA-256만 저장, 만료 시각과 명시 회수

파일 경로는 `FILE_UPLOAD_DIR/artifacts/<uuid>/v<version>.<ext>`를 사용한다. 기록 전 임시 파일은 실패 시 제거한다. 허용 크기는 HTML 5 MiB, PDF 20 MiB, PPTX 20 MiB다.

## API

모든 인증 API는 현재 JWT 계정을 소유자로 사용한다.

| Method | Path | Body/결과 |
|---|---|---|
| GET | `/v1/artifacts/files` | `{items: FileArtifactSummary[]}` |
| POST | `/v1/artifacts/files` | multipart `file`, optional `title` → 201 detail |
| GET | `/v1/artifacts/files/:id` | detail + versions |
| POST | `/v1/artifacts/files/:id/versions` | multipart `file`, `expectedVersion` → detail |
| GET | `/v1/artifacts/files/:id/versions/:version/content` | 원본 bytes |
| POST | `/v1/artifacts/files/:id/share` | optional `expiresAt` → `{token, expiresAt}` |
| DELETE | `/v1/artifacts/files/:id/share` | 공유 회수, 204 |
| GET | `/v1/artifacts/shared/:token` | 인증 없이 공유 metadata |
| GET | `/v1/artifacts/shared/:token/content` | 인증 없이 현재 버전 bytes |
| DELETE | `/v1/artifacts/files/:id` | body `expectedRevision` → 소유 파일 soft delete |

`FileArtifactSummary`: `id`, `kind`, `title`, `headVersion`, `revision`, `size`, `mimeType`, `updatedAt`, `shareActive`, `safePreview`.

Detail은 summary에 `versions[]`를 더한다. 버전 항목은 `version`, `originalName`, `mimeType`, `byteSize`, `sha256`, `createdAt`만 노출하며 저장 키와 경로는 비노출한다.

## 안전 규칙

- HTML은 `text/html`, `.html/.htm`, UTF-8 텍스트만 허용한다. 미리보기는 스크립트를 실행하지 않는 sandbox iframe 또는 escaping 경로를 사용한다.
- PDF는 `%PDF-` magic, `.pdf`, `application/pdf`를 확인한다.
- PPTX는 ZIP magic과 `.pptx`를 확인한다. 브라우저 변환기가 없는 현재 조건에서는 다운로드와 metadata preview를 제공하고, 안전한 미리보기 가능 여부를 응답의 `safePreview`로 구분한다.
- 확장자·magic·MIME이 다르면 저장 전에 400으로 거절하고 임시 파일을 제거한다.
- 공유 token은 생성 응답에서 한 번만 평문으로 반환한다. DB에는 hash만 둔다. 만료/회수/soft delete는 content 404로 수렴한다.
- 다른 계정의 ID는 403/404 차이로 존재 여부를 노출하지 않는다.

## 허브 연결

`/dashboard`는 기존 dashboard·report 결과에 Google 문서 summary와 파일 자산 summary를 합쳐 검색·유형·정렬·목록/그리드로 보여 준다. 각 행의 상세·편집 API는 기존 서비스 또는 `/artifacts/files/:id`로 이동한다. 기존 권한 결과를 그대로 사용하며 unified endpoint가 권한을 재해석하지 않는다.

파일 업로드는 Dashboard 허브의 명시 버튼에서 시작한다. 상세 화면은 metadata, 버전 목록, 소유자 열기, 버전 교체, 공유 링크 생성/회수, 삭제를 제공한다. 공개 링크 화면은 소유자 관리 UI 없이 현재 버전 metadata와 안전한 미리보기/다운로드만 제공한다.

## 검증

실제 MySQL8.4.11에서 HTML/PDF/PPTX 업로드, magic 거절, 목록, 상세, 버전 교체, 소유자 content, 공유 생성/열람/만료/회수, 다른 계정 거절, 삭제를 확인한다. 390/768/1440과 키보드로 목록 필터·업로드 dialog·상세·공유 dialog를 확인한다. 서비스·컨트롤러 테스트와 FE 타입/린트/빌드를 함께 실행한다.
