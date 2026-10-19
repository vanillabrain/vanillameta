# UC051 비공개 대시보드 최종 인계 검증

Status: Implemented slice; full acceptance open

[AIWF 설계](../plans/UC-051-handover-transfer.md)·[UC051 A7/BR08](../use_cases/UC-051-manage-enterprise-access.md)·[TC050 E02/E03](../test_cases/TC-050-enterprise-analysis.md)를 따른다. 의향/파일 관측과 별도인 소유자 준비→수신자 최종 수락→소유자 실행·완료 영수증을 연결했다. 비공개 단독 소유 대시보드1~20개 전부만 원자 이전하며 연결 소스는 이미 수신자 소유여야 한다. source/파일 인계·실제 퇴사/탈퇴·운영/실휴대폰·사람/전체16개 수용은 미실행이다.

## 설계·코드 검토

독립 검토에서 source read grant가 있는 이전 소유자의 Widget 재연결 경로를 확인했다. 원/대상 Dashboard 부모의 정렬 잠금과 현재 단독 소유 mapping 재검사를 추가하고 생성 전체를 transaction으로 묶었다. MySQL은 READ COMMITTED로 잠금 전 REPEATABLE READ snapshot의 옛 소유권을 재사용하지 않는다. 회귀는 수정 전 실제3건 실패→관련14개 통과다. 기존 정상 AI/Studio의 canonical Widget/Dataset 연결은 지원하되 공유/고아/손상 연결은 차단한다. 과거 행위자·개인 보기/보관·독립 사본·소스/파일/출력은 재작성하지 않는다.

FE 검토의 공개 종료 모순 응답을 보완했다. 부모 의향 공개가 종료되면 제목 없는 최종 영수증만 허용하고 최종 review 요청을 보내지 않는다. 별도 API/양쪽 당사자 컴포넌트 회귀를 확인했다. 완료 후에는 동의할 작업이 없으므로 최종 동의 체크도 숨긴다. ExportJob에는 dashboardId가 없으므로 대시보드별 출력 작업 부재를 주장하지 않는다. 기존 source 권한·출력 이력은 그대로다. 최종 mutation은 Source 뒤 canonical Widget→Dataset 행도 정렬 FOR UPDATE로 고정한다. 실제 두 연결의 두 객체별 DELETE 양순서에서 이전 뒤 삭제 대기 또는 선행 삭제 뒤 이전409/쓰기0을 확인했으며 전체 raw writer 보장으로 확대하지 않는다.

최종 검토는 잠금 대기 전에만 확인한15분 기한이 대기 중 만료될 수 있음을 지적했다. 수락/실행의 현재 기준 검토 후 변경 직전에 최종 기한을 다시 검사하며, 실제 service의 Dashboard 조회 await를 제어하고 clock을 최종 기한 이후로 진행한 수락/실행2개는 수정 전 실패→보완 후409와 전체 snapshot 불변을 확인했다. 이는 실제15분 대기를 수행한 화면 검증이 아니며 위 두 연결 DB 잠금 경합과도 구별한다. 완료 영수증 replay는 새 실행이 아니다.

최초 전체28개 파일 검토 후 만료 HIGH를 수정하고 최종4개 파일 집중 재검토에서 APPROVE/잔여0을 받았다. 검토자는 lint/정적 검토만 수행했으며 위 런타임 실행·제품/사람 수용과 구별한다. AIWF packet은 awaiting_review/acceptance not_recorded다.

## 선택 실행

- SQLite/JWT HTTP와 migration·기준 변경·전체 rollback·정확한 replay·같은 token 접근 경계를 선택 실행했다. 실제 MySQL8.4.11은 새 owned Docker 컨테이너의 검증 표식/UUID 확인 뒤 실행하고 컨테이너·임시 credential을 정리했다. Source 부모 변경과 실제 DashboardService 생성/수정의 잠금 대기 후 구 소유자 재연결403을 두 연결로 확인했다. 최종 기한 보완 후 MySQL215 PASS/17.683초·영향 SQLite57 PASS/7 SKIP다. 초기 SQLite211 PASS/8 SKIP(3 suites), 자식 잠금 MySQL213/SQLite55와 겹치며 합산하지 않는다.
- FE 초기 서비스/스토리지·부모/최종 패널112 PASS, 공개 종료 보완 후 영향59 PASS와 완료 체크 제거 후 컴포넌트25 PASS는 겹친다. BE/FE type·scoped lint·build와 선택 UC051/TC050 문서 lint를 확인했다. 초기 sandbox의 listen EPERM 배치는 환경 실패로 남기고 승인된 로컬 HTTP 실행 결과와 구별한다.
- Node22.23.1 환경이며 요구 Node24/운영 인증으로 확대하지 않는다. 전체 spec strict lint의 기존 오류는 선택 문서 통과와 별도다.

## Ego106 실제 화면·API

공개 합성 CSV를 실제 DuckDB로 가져오고 정상 AI 저장/Studio 저장 API로 숫자+차트 분석5·숫자 분석6과 폭별 배치를 준비했다. 소스301은 이미 수신자 소유인 fixture다. 기존 의향 수락은 배경 API로 준비했으며 최종 준비/수락/실행은 Ego 실제 UI에서 수행했다. 두 브라우저 계정을 동시에 로그인한 것으로 표현하지 않고 같은 공간에서 실제 로그아웃/로그인으로 역할을 전환했다.

1. 소유자 조건 검토에서 두 분석이 준비 가능함을 확인했다. 별도 체크 전 준비는 비활성이다.
2. 네트워크 offline 상태로 준비 요청이 미전달되면 UUID/입력이 탭에 보존됐다. online 복구→reload→원 의향 명시 조회→최종 상태404 후에만 같은 UUID 준비 재시도를 허용했다. 자동 새 요청/실행은 없다.
3. 수신자로 실제 로그인해 고정 최종 목록을 조회하고 별도 체크/최종 수락을 실행했다. 실제 XHR accept201을 확인했다.
4. 소유자로 실제 로그인해 최신 최종 상태를 조회한 뒤 별도 체크/전체 이전을 실행했다. XHR execute201·완료version3, reload→명시 재조회에서는 실행 버튼0과 같은 과거 기록을 확인했다.
5. 보호 API14회 대조에서 구 소유자의 Dashboard/Widget/Dataset403, 수신자 Dashboard/Studio200·admin/타 조직의 최종 기록403과 같은 실행 재시도를 확인했다. 완료 감사는1개다. 실제 재연결 API403은 source guard도 거치며, source read를 가진 늦은 서비스 재연결의 독립 검증은 위 MySQL/서비스 회귀다.

이전 전후 Dashboard ID/제목/정의/layout·Studio document bytes/블록과 모든 폭 배치·mapping ID를 대조했다. 허용 변경은 소유 actor·assetVersion+1·Studio legacyRevision과 해당 수정 시각이다. 관리 파일10개의 bytes/hash/mtime은 불변이다. 원 소스/지표 소유 변경이나 파일 복사/삭제는 없다.

390/768/1440에서 복구·완료 상태를 확인한다. 복구 화면의 주요 버튼36px/접기32px·checkbox16px, 각 clientWidth375/753/1425와 scrollWidth가 같아 가로 넘침0이다. 최종 빌드 수신자 완료 화면에서도 넘침0, 요청 입력36px/16·16·14px을 확인했다. 768/1440의 입력·버튼 top 차이는0px이며390은 세로 배치의44px(36높이+8간격)이다. 수신자 대시보드 reload에서 합계500과 채널 차트도 확인했다. screenshot은 실제 열람했으며 실휴대폰/멀티터치 검증이 아니다.

증빙/fixture/로그/스크린샷은 Git 제외 `.aiwf/evidence/UC051-handover-transfer/`에 보관한다. 기업/고객 식별 원문·사적 출처 경로·credential은 공개 산출물에 포함하지 않는다. AI 질문/LLM 동작은 이번 metadata 인계 검증에 포함하지 않는다.
