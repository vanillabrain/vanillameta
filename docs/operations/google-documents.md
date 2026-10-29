# Google 문서 연결 설정

이 기능은 사용자가 선택한 Google Docs 문서의 Markdown 사본을 VM에 비공개로 보관한다. Google 원문은 수정하지 않는다. 사본 가져오기와 갱신에 LLM을 사용하지 않는다.

## 준비

1. Google Cloud 프로젝트에 Drive API와 Google Picker API를 활성화한다.
2. Google Auth platform에서 웹 애플리케이션 OAuth 클라이언트를 만든다.
3. 동의 화면에 `https://www.googleapis.com/auth/drive.file` 범위를 등록한다. 테스트 상태에서는 검증에 참여할 Google 계정을 테스트 사용자로 추가한다.
4. 승인된 리디렉션 URI에 VM 웹 주소의 `/documents/google/callback`을 등록한다. 서버 설정 값과 정확히 일치해야 한다.
5. 서버의 비밀 설정에 아래 값을 제공한 뒤 API를 다시 시작한다. 클라이언트 비밀과 암호화 키를 프런트엔드 번들에 넣지 않는다.

| 설정 | 용도 |
|---|---|
| `GOOGLE_DOCS_CLIENT_ID` | Google 웹 OAuth 클라이언트 ID |
| `GOOGLE_DOCS_CLIENT_SECRET` | 해당 클라이언트 비밀 |
| `GOOGLE_DOCS_REDIRECT_URI` | 예시 `https://app.example.com/documents/google/callback` |
| `CONFIG_SECRET_KEY` | 서버 자격증명 암호화. 기존 값을 임의로 변경하면 기존 연결을 읽지 못한다. |

운영 callback은 HTTPS를 사용한다. 비운영 환경만 localhost 또는 loopback HTTP callback을 허용한다. callback URL에는 query, fragment, 사용자 정보가 없어야 한다. 프런트엔드 정적 서버는 callback 경로를 SPA 진입점으로 전달해야 한다.

## 사용

1. VM에서 조직에 참여한 계정으로 로그인한다.
2. 아티팩트 목록에서 문서를 연다.
3. Google Docs 링크를 입력하고 연결 범위를 확인한다.
4. Google 승인 화면에서 해당 문서를 선택한다. 다른 문서를 선택하면 VM이 연결을 거절한다.
5. VM으로 돌아온 뒤 사본 만들기를 선택한다. 성공하면 보관 버전과 원본의 관측 version, 가져온 시각이 표시된다.
6. 원문이 바뀌면 갱신을 선택한다. 과거 보관 버전은 버전 선택에서 다시 읽는다.

Google의 `drive.file` 권한은 선택한 파일의 편집 권한도 포함한다. VM의 이번 기능은 해당 문서의 메타데이터 조회와 Markdown 내보내기만 수행한다. 전체 Drive를 읽는 권한은 요청하지 않는다. Google에서 과거 승인한 다른 파일이 있더라도 VM 문서 연결에는 고정한 파일 ID만 사용한다.

## 실패와 복구

설정이 없으면 VM은 관리자 설정 안내를 표시한다. 연결됨으로 표시하지 않는다. 원문이 삭제되거나 내보내기 권한이 없으면 새 사본을 만들지 않는다. 연결 승인 도중 실패했으면 목록에서 결과를 확인한 후 새 승인을 시작한다.

사본 저장 결과를 받지 못하면 보관한 요청의 결과를 먼저 확인한다. 조회는 새 저장을 실행하지 않는다. 원문이 내보내기 중 변경되면 기존 버전을 보존하고 새 명시 요청을 기다린다.

연결 해제는 VM에 저장된 Google 자격증명 사용을 중단한다. Google 계정의 OAuth 앱 승인 자체를 철회하는 동작은 아니다. 원하면 Google 계정의 연결된 앱 관리에서 별도로 해제한다. VM 사본은 독립 자료이므로 연결 해제 후에도 현재 소유자와 원래 조직 범위에서 보존된다.

## 현재 범위

한 문서는 최대 2 MiB, 한 문서의 보관 버전은 최대 50개다. 사용자와 조직 조합의 문서 연결은 최대 20개, 사본 내용 합계는 최대 20 MiB다. 상한에 도달해도 기존 버전을 자동 삭제하지 않는다. 외부 이미지와 첨부파일은 보관하지 않으며 Markdown 안의 HTML은 실행하지 않는다.

Google 승인과 실제 원문 내보내기는 OAuth 설정을 준비한 뒤 별도 검증해야 한다. 현재 모의 Google 응답을 이용한 검사는 실계정 연결 완료를 뜻하지 않는다. MS 문서 연결, AI 요약, 조직 공유, 원격 MCP OAuth는 별도 작업이다.

## 근거

- [Google Picker redirect](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).
- [Google 문서 내보내기 형식](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).
- [검증 기록](../testing/document-connections.md).
