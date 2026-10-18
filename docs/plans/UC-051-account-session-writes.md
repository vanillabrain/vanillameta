# UC051 계정·세션 쓰기와 가입 후 샘플 경계

FR016/017·NFR005/008·TC050 E02/E03 후속. 기준0f54883a이며 전체16개 목표는 유지한다. 기준 버전의 갱신 인증 읽기는 확정 상태를 사용했지만 세션 저장·로그아웃/계정 변경은 다른 transaction에 흡수될 수 있었다. 이 결함과 부분 실패를 보완한다.

## 설계

setRefreshKey는 실제 메타데이터 manager transaction에서 현재 계정/현재 연결 session을 읽고 token 저장+User.jwtId 연결을 함께 commit한다. 전달된 이전 jwtId는 현재 DB 연결을 덮는 권한이 아니다. 서버 발급 token의 actor/epoch와 현재 active 계정을 확인하며 실패 시 token/사용자 모두 불변이다. MySQL은 현재 사용자 행 잠금으로 회전 작업을 직렬화하며 SQLite는 공통 큐다. 기존 signin 응답/cookie·메서드 인자는 유지한다. logout은 guard가 검증한 token을 요청 내부에만 보관해 id+token 조건의 단일 UPDATE로 비운다. 같은 행이 새 로그인으로 이미 교체됐으면 새 token은 보존하고 no-op으로 종료한다. 기존 HTTP 응답/cookie·입력 인증401은 유지하고 token을 응답/로그/저장 초안에 추가하지 않는다. 일반 인증/legacy password rehash와 재발급용 계정 조회도 확정 읽기를 사용한다.

UserService의 계정 비밀번호 확인→변경/삭제·소속 검사, 사용자/매핑 조회·쓰기와 LoginService 가입 중복 확인→저장을 공통 SQLite 범위로 조합한다. 조직 계정 삭제409·비대상 불변과 기존 외부 응답을 유지한다. 가입 후 sample provisioning은 가입 metadata 범위를 빠져나온 뒤 시작하고 샘플 실패로 가입 성공을 취소하지 않는다. 샘플 metadata read/write는 공통 큐에 참여시키되 별도 샘플 SQLite 파일 생성/seed·외부 작업은 큐 밖에 둔다. 샘플 자산 전체 원자 생성/재시작 복구는 이 단위 계약이 아니다.

## 검증

실제 SQLite에서 token 저장 뒤 사용자 갱신 실패를 trigger로 주입해 기존 token 보존/첫 연결 생성0을 검사하고, held Studio/enterprise rollback 중 회전/로그아웃·계정 변경 성공 유실을 수정 전 재현한다. 저장된 계정·token actor/epoch/연결의 독립 검증·현재 연결 hint 변경·비활성/오래된 epoch 거절을 확인한다. 계정/가입/샘플 범위는 실제 DB/선택 회귀와 외부 worker 중 metadata 진행을 확인한다. type/lint/build·관련 전체 회귀/core·독립 검토/문서·strict/pin/check/packet 뒤 explicit stage/비공개 검사/commit/push한다. 새 UI/schema/의존성은 없다. MySQL 실제 경합·Ego/모바일·운영·전체 TC050은 미검증으로 남긴다.

## 독립 검토의 잔여

Auth의 late-logout 지적은 실제 RED 후 조건 UPDATE로 해소했다. MySQL 가입에는 userId/email unique 제약이 없고, membership userId에도 User FK가 없어 동시 가입·조직 편입/삭제 경합의 DB 보장이 남는다. 현재 SQLite queue와 정상409 테스트를 그 보장으로 확대하지 않는다. 후속은 기존 중복/고아 데이터의 안전한 진단과 additive unique/FK·해당 mutation의 공통 행 잠금/409·실제 local Docker MySQL 경합 검증이다. 자동 데이터 삭제/병합은 하지 않는다. 샘플 여러 자산 원자성/재시도 receipt도 별도다.
