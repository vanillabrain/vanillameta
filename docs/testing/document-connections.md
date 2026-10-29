# Google 문서 연결 검증

2026-10-29. 기준 develop `42710147`와 미커밋 작업 트리. 기존 목록 검증은 관련 변경이 없는 조건에 재사용한다.

## 실행 조건

실제 Google OAuth 설정이 없다고 사용자가 확인했다. Google 연결 승인 자체는 BLOCKED다. 네트워크 모의 응답은 Google 서버의 실제 동작 증빙이 아니다. 원문은 합성 매출 보고서이며 개인 Drive의 문서를 읽지 않는다. gpt-6-luna 설정은 유지하고 문서 가져오기에는 AI를 호출하지 않는다.

## MD 시나리오

| ID | 조작과 기대 결과 | 현재 판정 |
|---|---|---|
| DOC-01 | 설정이 없을 때 관리자 설정 안내. 성공 또는 연결됨으로 표시하지 않는다. | 실제 UI PASS |
| DOC-02 | Google Docs 링크를 입력하고 명시 승인. 선택 파일 scope, PKCE, 고정 callback. 다른 host·파일 선택·만료 state 거절. | 단위·모의 callback HTTP/UI PASS, 실 Google BLOCKED |
| DOC-03 | 연결 완료 뒤 원문 사본 만들기를 선택한다. 순매출 16,537.01과 정확한 Markdown, hash, 원본 관측 version을 v1에 보관한다. | 실제 MySQL/API·UI PASS |
| DOC-04 | 목록과 문서 재열기. 조회만으로 Google 가져오기·새 버전·요약이 발생하지 않는다. | 실제 MySQL/API·UI PASS |
| DOC-05 | 원문 변경 후 명시 갱신. v2와 v1을 각각 읽을 수 있고 같은 원문은 버전을 추가하지 않는다. | 실제 MySQL/API·UI PASS |
| DOC-06 | Google 실패·내보내기 중 변경·다운로드 권한 거절. 기존 버전과 현재 포인터를 보존한다. | 단위·실제 DB/실패 UI PASS |
| DOC-07 | commit 뒤 응답 유실. 원 UUID 결과 조회로 확인하고 중복 버전이 생기지 않는다. UUID 입력 변경은409다. | 동일 UUID API·서비스 PASS, 실제 네트워크 응답 유실 주입 NOT_RUN |
| DOC-08 | 다른 사용자·조직, 낡은 epoch, 처리 중 권한 변경을 거절한다. 거절 응답은 문서와 토큰을 포함하지 않는다. | SQLite 동시 상태 검사·다른 계정 HTTP404 PASS |
| DOC-09 | 연결 해제 후 Google 호출을 중단한다. 보관 사본은 현재 본인·원 조직 권한에서 남아 있다. | 실제 MySQL/API·UI PASS |
| DOC-10 | 데스크톱 Tab·Shift+Tab·Enter·Escape로 연결 창을 조작한다. 닫은 뒤 시작 버튼으로 초점이 돌아온다. | 연결 창 Tab/Enter/Escape PASS, 네이티브 선택 방향키 미검증 |
| DOC-11 | 현재·과거 버전과 오류 화면의 버튼·입력 높이, 긴 제목, 테마 대비와 넘침을 실제 화면에서 확인한다. | 기본 테마 데스크톱 선택 화면 PASS, 다른 테마/긴 제목 미검증 |

## 공급자 경계 검사

첫 공급자 검사19개가 통과했다. 선택 파일 scope와 PKCE, 신뢰하지 않는 URL 거절, 운영 callback의 HTTPS, token exchange의 고정 endpoint, 새 연결의 refresh token 필수, 갱신 token 보존, 정확한 Markdown bytes와 큰 문자열 version, 원본 변경, 문서 타입/권한/삭제 상태, streaming byte 상한, 비밀 없는 오류를 확인했다.

실제 Google 승인, 운영 배포, 모바일 설계, VoiceOver는 이 검사로 확인하지 않았다. 증빙 디렉터리는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/document-connections-20261029`다.


## 실제 실행과 수정

Ego91과 소유 MySQL8.4.11/API4264/WEB3264/CONTROL4464를 사용했다. Google 네트워크만 테스트 preload가 합성 응답으로 대체했다. 실제 Google 토큰이나 문서는 사용하지 않았다. API 호출과 DB 저장, UI 조작을 모의 화면으로 대체하지 않았다.

v1의 순매출16,537.01과 v2의18,204.15를 정확히 보관했다. 서버 재시작 후 두 버전의 GET200과 동일 본문을 확인했다. 같은 원문과 같은 UUID 재전송은 v2를 유지했다. 다른 계정의 직접 문서 조회는404였다. 새 마이그레이션은 별도 빈 MySQL 스키마에서 두 번 실행했으며, 한글·이모지120,000bytes를5청크로 저장한 뒤 원문과 일치했다. 운영 DB migration 수용은 별도다.

독립 검토에서 오래된 버전의 사전409가 실패 영수증을 남기지 않아 복구가 막히는 문제, 실패·미접수 요청이 연결 해제와 겹치면 재연결이 막히는 문제, UTF-8 BOM 손실을 발견했다. 실패 회귀를 추가하고 상태 전환과 bytes 보존을 수정했다. 실패 영수증을 유지한 채 실제 재연결 버튼이 활성화되는 것을 화면에서 확인했다. 영수증 미접수와 연결 해제 조합은 컴포넌트 회귀 범위다.

본문이 화면 아래로 밀리던 배치를 원본 제어와 보관 본문 두 열로 정리했다. 해시·수정 시각은 접을 수 있는 버전 정보로 옮겼다. 첫 사본이 없을 때 버전0 대신 첫 사본 저장 전으로 표시한다.

## 검증 제한

네이티브 select의 Space/방향키/Enter와 CDP 키 입력은 이 Ego 실행에서 버전 선택을 바꾸지 못했다. `selectOption`으로 과거 버전 표시를 확인했지만 방향키 통과로 세지 않는다. 실제 Tab 순환과 Escape 후 연결 시작 버튼 초점 복귀는 별도 관측했다. 캡처 시간 초과와 Vite HMR로 교체된 참조는 같은 공간에서 복구했으며 저장 요청을 무조건 반복하지 않았다.

백엔드 최종44개 검사와 FE 선택4파일60개, Node24.19.0 타입/린트/빌드가 통과했다. SQLite 단위 검사는 이 체크아웃의 sqlite3 네이티브 바인딩 부재 때문에 같은 저장소의 기존 rbac-system 워크트리 바인딩을 명시 매핑했다. MySQL 실제 실행은 이 매핑을 사용하지 않았다. 배치별 검사 수를 합산해 전체 완료율로 쓰지 않는다.

외부 AI 원격 OAuth, MS 연결, 유료 요약, 문서 공유, 모바일 신규 설계는 이번 구현 단위에 포함하지 않았다. gpt-6-luna 설정과 VoiceOver 차단은 유지했다.

## 최종 화면과 정리

Ego의 최종 실제 viewport는1800×849였고 문서 목록 가로 넘침0, 연결 버튼 높이40px을 확인했다. 초기 요청한 emulation 폭을 실제 캡처 폭으로 잘못 기록하지 않는다. 대표 증빙은 `connect-keyboard.png`, `import-v1.png`, `refresh-v2.png`, `previous-v1.png`, `refresh-failure.png`, `failed-disconnected-recovery-final.png`, `configuration-required.png`다. 중간의 `failed-disconnected-recovery.png`는 HMR 뒤 미확정 상태로 돌아간 관측이며, 연결 복구 통과는 `-final` 캡처와 실제 활성 버튼 관측을 따른다.

API의 원본 hash와 보관 수치는 `server-v1.json`, `http-recovery.json`, `stale-recovery-api.json`에 있다. 실제 Google 승인을 대신한 callback에는 합성 code만 사용했고, 처리 후 query 제거와 기존 문서 재연결을 확인했다.

CONTROL4464의 정상 stop200, status=stopped, 이번 소유 컨테이너0, runRoot 제거를 확인했다. Ego91을 종료하고 테스트 인증정보 임시 파일을 삭제했다. 기존 보존 실패 환경22e26a는 변경하지 않았다. 검증용 빌드 설정과 실행 사본은 저장소에서 제거하고 비밀 없는 증빙만 남겼다. 커밋·push·배포는 실행하지 않았다.
