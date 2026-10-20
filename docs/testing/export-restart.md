# UC054 출력 작업 프로세스 재시작 복구

상태: Draft. FR023/NFR005~008의 제한된 구현·실행 증빙이다. 전체16개/TC050 수용은 Open이다. [계획](../plans/UC-054-export-restart.md)·[UC054](../use_cases/UC-054-export-comparable-analysis.md)를 따른다.

## 수정한 결함

- 가입의 detached 샘플 생성과 큐 밖 LoginHistory 자동 transaction이 SQLite 한 연결에서 겹쳤다. 실제 API 재시작 전 접수201이었지만 조직·업로드·출력 작업이 디스크에 확정되지 않아 사라졌다. 로그인/사용자 조회/공유 기록의 save를 공통 큐에 연결했다. 샘플 외부 파일 생성을 metadata transaction 안으로 옮기지 않았다.
- 최종 부분 저장 중 작업 TTL이 지나도 임대가 살아 있으면 ready를 확정할 수 있었다. 최종 CAS에서 `expiresAt > now`를 함께 검사해 부분·완료 감사를 rollback한다.
- 그룹 export 권한 회수와 완료 확정이 같은 Source 잠금을 쓰지 않았다. User/Job→Source/Metric 잠금 뒤 현재 접근권·기준을 다시 읽고 완료 저장까지 잠금을 유지한다. 집계 SQL은 metadata transaction 밖이다.
- 최신 상태 읽기 실패 뒤 이전 버전의 재실행/파일 전달이 가능했다. 마지막 작업·고정 조건을 보존하면서 성공적인 명시 조회 전 동작을 막는다. 확인된 응답을 같은 작업의 목록에도 반영해 상태 모순을 없앴다. running/interrupted/ready 안내와 주요36px·도구32px, 같은 행 중앙 정렬을 적용했다.

## 자동 실행 증빙

2026-10-19, 로컬 Node22.23.1. 각 배치는 별도 범위이며 합산해 전체 수용률로 계산하지 않는다.

| 범위                                                      | 결과                   | 증명 범위                                                                |
| --------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `node scripts/verify-semantic-mysql.cjs --export-restart` | 1 suite / 7 PASS, 29초 | 소유 임시 MySQL8.4.11와 실제 native DuckDB, 별도 OS 프로세스/연결        |
| `export-jobs.spec.ts`                                     | 1 suite / 21 PASS      | SQLite/DuckDB/JWT HTTP, 최종 TTL 중 부분 rollback 포함                   |
| sample/login 영향 범위                                    | 7 suites / 22 PASS     | 세 middleware의 실제 파일 DB 재오픈·transaction depth0, 로그인/샘플 영향 |
| `ExportJobs.test.tsx`                                     | 50 PASS                | 명시 읽기/재실행·조회 실패 후 stale 동작 차단                            |
| BE/FE type·build·대상 lint                                | PASS                   | middleware 기존 unused 경고9, 오류0; FE 대상 경고0                       |

MySQL은 실제 서비스들을 호스팅하는 테스트 전용 IPC 자식 프로세스를 SIGKILL하고 새 PID로 같은 DB/파일에 연결한다. 전체 Nest HTTP 서버를 MySQL로 띄운 검증은 아니다. 접수·완료·실행 작업 보존, GET/list/file의 쓰기·자동 집계0, 여러 CSV 부분의 순서/bytes/SHA-256, 두 프로세스의 같은 버전 재실행 단일 확정, 현재 권한·소유권·epoch, 실행 중 권한/epoch 회수, 부분 저장 중 TTL rollback을 확인했다. 실제 그룹 정책 writer와 완료의 complete-first/revoke-first 양방향 잠금 경합도 확인했다.

임대/TTL 경과는 소유 테스트 DB 행을 조정해 가속했다. 운영 LEASE5분/TTL24시간이나 production 시작 훅을 변경하지 않았다. 강제 종료와 실제 데이터 영속성을 확인했지만 자연스러운 5분 경과·운영 장애 수용을 뜻하지 않는다. 소유 컨테이너·임시 credential·테스트 파일을 정리했으며 영속 Docker volume은 만들지 않았다.

첫 export 회귀 실행에는 기존 fixture의 SourceCatalogEntry metadata 누락으로 실패가 있었다. 최신 집계 의존 엔티티를 포함한 최종21 PASS와 구분한다. sample 경합 회귀는 수정 전3 FAIL을 보존하고 수정 후22 PASS를 기록했다. 진단 로그의 임시 출력 코드는 제거했다.

## Ego113 실제 전체 HTTP 화면

소유 QA SQLite/native DuckDB API와 Vite 화면, 합성 CSV3행(100/200/300)을 사용했다. 실제 LLM은 호출하지 않았다.

1. 소스 탐색 합계600·일별100/200/300 확인→현재 조건으로 파일 작업1 접수.
2. 전체 API 프로세스를 종료·새 PID로 재시작→브라우저 새로고침→파일 작업 펼치기→이전 작업 읽기→동일 대기 작업1 선택. 자동 실행 없이 명시 CSV 만들기→상태 다시 읽기로 ready 확인.
3. 고정 파일 실제 다운로드→전체 API 두 번째 새 PID 재시작→새로고침/이전 작업 읽기→같은 ready 작업1→실제 다운로드. 두 파일의 SHA-256이 같고 CSV15행/1234bytes다. DB는 queued/running/ready 감사 각각1건, 작업1 version3·부분1개이며 ready의 재실행 버튼은 차단된다.
4. 브라우저 offline에서 선택 작업 다시 읽기 실패→마지막 ready/고정 조건 보존·다운로드 차단→online 복원→명시 재조회 후 다운로드 허용.
5. 별도 작업2의 running/만료 임대는 소유 SQLite DB fixture로 준비했다. 화면의 실행 중단→명시 CSV 만들기→상태 재조회→ready를 확인했다. 이 화면 시험을 실제 실행 중 HTTP 서버 강제 종료로 주장하지 않는다.
6. 최종390/768/1440px에서 패널과 버튼을 캡처·실측했다. 주요36px·도구32px·폰트14px, 가로 넘침0. 두 크기의 같은 행은 중앙 정렬하고 좁은 폭에서는 줄바꿈한다. 이 패널에는 입력 필드가 없다. Chromium viewport 검사이며 실휴대폰은 아니다.

실행 로그·PID·CSV·화면·측정치는 Git 제외 `.aiwf/evidence/UC054-export-restart/`에 보존한다. 보안 정보와 임시 계정 credential은 커밋하지 않는다. 이전 실패 증빙을 최종 성공으로 덮어쓰지 않는다.

## 남은 수용

전체 HTTP 앱의 MySQL 실행/운영 migration·자연 시간 경과·강제 중단 모든 위치·대규모 운영, 전체 비교 리포트 정답/역할 행렬, 실제 휴대폰·사람 수용은 별도다. 이번 통과로 FR023/NFR008 전체 또는 전체16개/TC050을 완료 처리하지 않는다.

문서 검사 UC054/TC050은 각각 오류0·경고0이다. 전체 strict 검사는 기존17오류·5경고를 유지하며 이번 변경 통과로 숨기지 않는다. 별도 코드 검토의 두 P2는 수정 후 해결 확인됐고 남은 코드 finding은0이다. 문서/패킷 상태는 승인·수용과 별개다.
