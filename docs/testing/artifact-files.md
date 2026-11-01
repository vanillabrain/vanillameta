# 파일 아티팩트 실제 검증

2026-11-01. 기준 브랜치 `develop`, 검증 시작 HEAD `76c6d0cc`. 기존 파일 아티팩트 구현의 F01·F02·F03을 실제 API와 브라우저로 확인했다. 이번 실행에서는 제품 코드 수정이 필요하지 않았다.

## 환경과 자료

- 웹 `http://127.0.0.1:3000`, API `http://127.0.0.1:4000/v1`, 로컬 SQLite 메타데이터와 로컬 파일 저장소
- 조직에 소속된 `guest` 계정으로 업로드·교체·공유·회수를 수행하고, 인증 쿠키와 토큰이 없는 별도 브라우저 문맥으로 익명 공유 링크를 열었다.
- HTML v1은 실행 확인용 `script`를 포함한다. PDF는 505→459 bytes, PPTX는 440,820→646,157 bytes의 서로 다른 v1/v2 파일을 사용했다.

## 결과

| ID | 실제 수행과 결과 | 판정 |
| --- | --- | --- |
| F01 업로드·안전 미리보기 | `/dashboard`의 업로드 대화상자를 키보드 Enter로 열고 HTML v1을 업로드했다. 상세에서 iframe의 `sandbox`가 빈 값으로 적용되고, 문서 제목은 `QA File Artifact`, body의 `data-script-ran`은 null이었다. 인라인 script의 제목 변경도 실행되지 않았다. | PASS |
| F01 공유·버전 교체 | HTML 공유 링크 생성 201, 익명 미리보기 v2 200. v2 교체 201 뒤 선택기에서 v1과 v2를 각각 열어 제목이 `VanillaMeta file artifact`→`v2`로 구분됐다. 공유 링크도 현재 head v2를 제공했다. 회수 204 뒤 같은 공유 주소는 404였다. | PASS |
| F02 PDF | PDF v1 업로드·상세 object 표시·다운로드 성공. v2 교체 201, 이전 v1 보존, 다운로드 SHA-256과 API 200 bytes가 일치했다. 익명 공유 사용 후 회수 204, 재접근 404였다. | PASS |
| F03 PPTX | PPTX v1 업로드 후 브라우저 렌더링 대신 metadata·다운로드 안내를 표시했다. v2 교체 201, v1 보존, 두 버전 다운로드 SHA-256과 API 응답이 일치했다. 익명 공유 사용 후 회수 204, 재접근 404였다. | PASS |
| 반응형 | HTML·PDF·PPTX 상세를 390·768·1440에서 확인했다. `scrollWidth-clientWidth`는 모두 0이었다. | PASS |
| 응답 경계 | 모든 버전 응답은 `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options` 상당의 CSP sandbox header를 반환했다. PPTX는 `attachment`, HTML·PDF는 `inline` Content-Disposition이었다. | PASS |

## 바이트 검증

- HTML v2: 363 bytes, `764f5fed76cf856f19fd402182a058941cf720f9ac19578d3105b28024a0fb98`
- PDF v2: 459 bytes, `b55f333ede7b1d4bd19a09447e84b7e289af4af269b6a0e35cd61eda10ca7061`
- PPTX v2: 646,157 bytes, `ef0968e8ff348aae7549c6ef3fe8e6fbc19f2771094b952f189cb4e7ee388bc5`

세 유형 모두 공유 상세 200·공유 content 200·회수 204·회수 후 content 404였으며, 공유 content 해시는 v2 다운로드 및 상세 버전 metadata와 일치했다.

## 검사

- backend artifact service/controller: 2 suites, 25 PASS
- frontend artifact pages/service: 6 files, 14 PASS
- 이번 문서 변경은 테스트 동작을 수정하지 않았다.

## 제한

- headless Chromium의 내장 PDF 뷰어는 화면 캡처에서 빈 object로 보일 수 있다. PDF object 존재, MIME, 다운로드 bytes와 SHA-256, 공유 content를 별도로 확인했으며 이 제한을 PDF 렌더 성공으로 확대하지 않는다.
- PPTX는 제품 설계대로 브라우저 미리보기를 제공하지 않는다. metadata, 다운로드, 버전과 공유만 검증했다.
- VoiceOver, 실제 Google/Microsoft OAuth, 운영 PostgreSQL, 운영 배포는 이번 범위가 아니다.

## 증빙

- `/Users/moonklabs/workspace-vanilla/phase2-evidence/artifact-files-20261101/verification.json`
- `html-v2-1440.png`, `html-v2-768-viewport.png`, `html-v2-390-viewport.png`
- `pdf-v2-1440.png`, `pptx-v2-1440.png`
- `html-shared-v1-1440.png`, `html-shared-revoked-1440.png`
