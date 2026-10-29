# 외부 AI 원격 OAuth 검증

2026-10-29. Google 문서 연결 커밋453bbe63 이후 작업 트리. [구현 계획](../plans/remote-ai-oauth.md).

## MD 인수 조건

| ID | 조작과 기대 결과 | 판정 |
|---|---|---|
| ROAUTH-01 | 비인증 MCP401에서 보호 리소스 metadata와 승인 서버 발견 | 실제 HTTP PASS |
| ROAUTH-02 | 미등록 client, 다른 redirect/resource, PKCE 누락/plain을 거절하며 임의 주소로 redirect하지 않음 | 단위·로컬 HTTP PASS |
| ROAUTH-03 | 로그인 후 원 승인 화면으로 복귀. 계정·현재 조직·요청 범위를 표시 | 실제 UI PASS |
| ROAUTH-04 | 취소는 원 state와 access_denied만 반환. grant/code/token 생성0 | 실제 UI·API PASS |
| ROAUTH-05 | 문서 읽기만 선택해 승인. 공식 MCP client에서 문서 도구만 보임 | 실제 UI·공식 SDK PASS |
| ROAUTH-06 | 본인 문서 읽기 성공, 타 조직/타인 문서·미승인 소스 도구 거절 | 실제 SDK·MySQL PASS |
| ROAUTH-07 | code 단회 사용, 잘못된 verifier 거절, 웹 JWT/MCP token 교차 사용 거절 | 실제 SDK/HTTP·단위 PASS |
| ROAUTH-08 | 연결 해제 확인 창 취소/Escape는 관계 보존, 확정 후 기존 token의 MCP 요청401 | 실제 UI·HTTP PASS |
| ROAUTH-09 | 조직·epoch·계정·client 설정 변경과 긴 조회 중 회수는 결과 반환 차단 | 단위·HTTP 선택 조건 PASS |
| ROAUTH-10 | 재시작 후 grant/token 상태 보존. 만료 pending 보관량 때문에 신규 승인이 영구 차단되지 않음 | API 프로세스 재시작·단위 PASS |
| ROAUTH-11 | 데스크톱 버튼·입력 정렬, 권한 checkbox와 확인창 Tab·Enter·Escape | 데스크톱1800×849 선택 화면 PASS |

## 범위

자체 VM OAuth와 공식 MCP SDK client를 로컬 MySQL8.4.11/API4265/WEB3265에서 실행한다. callback4466은 별도 합성 검증 클라이언트다. 실제 Claude/Codex/ChatGPT 제품의 외부 계정 연결 또는 공개 인터넷 배포를 검증한 것으로 표시하지 않는다. Google OAuth·문서 원본 연결은 이번 승인과 독립적이다.

MCP 원격 읽기 범위는 소스 목록·열 이름/타입과 명시한 보관 문서 버전의 제한된 본문이다. 문서는 합성 매출 내용이다. 사용자 JWT와 외부 OAuth token을 교환해 사용하는 경로는 없다. 실제 생성·저장·공유 도구와 모델 호출은 포함하지 않는다. 기존 gpt-6-luna 설정과 VoiceOver 차단 상태, 모바일 제외를 유지한다.

증빙은 `/Users/moonklabs/workspace-vanilla/phase2-evidence/remote-ai-oauth-20261029`에 보관한다. 비밀번호·authorization code·access token은 증빙에 기록하지 않는다.


## 실행 결과

Ego92에서 OAuth 시작 → 로그인 → 원 승인 화면 복귀를 확인했다. 키보드로 취소한 요청은 callback의 access_denied, code없음, grant0을 확인했다. 별도 요청에서 소스 범위를 해제하고 문서 범위만 승인했다. 공식 SDK2.3.1에서 문서 도구2개만 보였고 본인 사본 읽기·다른 조직 사본 거절·미승인 소스 도구 거절을 확인했다.

실제 MySQL에서 같은 code를 동시에 교환하면200과400으로 나뉘었다. code재사용400, 일반 JWT의 MCP 사용401, MCP token의 일반 API 사용401을 확인했다. API 프로세스 재시작 후 기존 token으로 도구를 다시 조회했다. 해제 창 Tab 순환과 Escape 후 시작 버튼 초점 복귀를 확인했으며 취소 후 grant는 유지됐다. 명시 해제 뒤 같은 token은401이고 사본 GET200·버전1을 보존했다.

소스 읽기만 승인한 별도 SDK 검사는 현재 조직의 소스1개만 반환하고 다른 조직 소스 접근을 거절했다. 미지원 MySQL 소스는 supported=false/status=unsupported를 반환하며 빈 정상 schema로 표현하지 않는다. 접속 비밀은 응답에서 제외했다. 이 범위의 source SDK 결과는 `source-sdk.json`이다.

마이그레이션은 새 빈 MySQL 스키마에서 두 번 실행했고, 네 개 테이블의 entity schema diff가0이었다. `migration.json`을 따른다. 공개 배포 DB나 nginx 실행 검증은 아니다.

## 발견한 오류와 수정

- 전체 과거 pending 수를 admission 상한으로 쓰면 만료 뒤에도 신규 연결을 영구 차단했다. 유효 pending1000개와 browser별10개만 계산하고 만료 pending을 최대500개씩 정리한다. grant·code·token·사용자 자료는 이 정리에서 제외한다.
- OAuth 오류 필터가 기존 로그인 JWT 갱신 신호를 가렸다. 인증 읽기의 정확한 accessTokenExpired401 신호를 보존했다. 결정/해제 POST의 자동 재전송은 계속 비활성이다.
- 미지원 소스 상태가 투영 중 빠졌다. 지원 여부와 명시 unsupported 상태를 반환한다.
- epoch·조직·client 설정이 바뀌어 이미 무효인 grant까지 연결20개 상한에 포함했다. 현재 승인 문맥의 유효 grant만 세도록 고쳤다. 재현3실패 후 회귀를 추가했으며 과거 기록은 삭제하지 않는다.
- 승인 만료와10분 access token 만료를 구분하는 문구를 추가했다.

## 검증 환경 중단과 경계

추가 migration 검사 스크립트가 `getTables()`를 무제한 호출해 시스템 테이블까지 조사했다. 이때 첫 임시 MySQL이 OOM/137로 종료됐다. tmpfs 설정 때문에 재시작한 DB는 비어 있었고 동적 포트도 바뀌었다. 이를 제품 데이터 복구 성공으로 표시하지 않는다. 소유 확인한 임시 포트 연결로 원인을 분리한 뒤, 첫 환경을 감독기의 정상 stop으로 정리했다.

실행기는 네 테이블만 조회하도록 수정했다. 새 소유 환경에서 migration과 미검증 소스 조건만 확인했다. 이미 완료한 브라우저 승인·취소·해제 흐름은 재실행하지 않았다. 초기 OOM 관측과 후속 PASS는 다른 실행이며 수치를 합산하지 않는다. 기존22e26a 보존 환경은 변경하지 않았다.

첫 FE5파일127개와 최종 FE3파일47개는 겹친 검사다. 백엔드는 최종68개가 통과했다. 실제 HTTP 검사는 MCP_OAUTH_HTTP_TESTS=1로 실행했다. SQLite 네이티브 바인딩은 같은 저장소의 rbac-system 워크트리 것을 명시 매핑했다. 타입·변경 lint·Node24 빌드도 통과했다.

실제 외부 AI 제품 로그인, 공개 HTTPS/nginx 경유, 자동 client등록, refresh token, AI 생성·쓰기·게시, 모바일·VoiceOver는 이 검증의 통과 범위가 아니다. OAuth code와 token은 임시 파일에만 보관하고 종료 시 제거한다.

## 종료와 증빙

대표 화면은 `consent-documents-only.png`, `cancelled.png`, `disconnect-dialog-keyboard.png`, `disconnected-final.png`다. 도구 실행은 `sdk-results.json`, `source-sdk.json`, 취소는 `cancel-result.json`, 해제는 `revocation.json`, 재시작은 `restart-token.json`을 따른다. 초기 `disconnected.png`에는 닫힘 처리 중인 창이 남아 있으므로 최종 상태 증빙에는 `-final`을 사용한다.

두 소유 런타임 모두 정상 stop200으로 정리했다. 마지막 status=stopped·소유 컨테이너0·runRoot 제거를 확인했다. 임시 port 연결과 callback4466도 명령 경로를 대조해 종료했다. Ego92를 종료하고 PKCE verifier·code·token·테스트 로그인 임시 파일을 제거했다. 기존22e26a 보존 환경은 변경하지 않았다.

Google 문서 기능은453bbe63을 drumcap으로 develop에 push했다. 이번 원격 OAuth 변경은 미커밋이며, 기존 무관한 목록 디자인·Claude 설정 변경은 보존했다.
