# UC053 받은 분석 독립 복제 생성 요청 복구 검증

Status: Selected verification passed; full acceptance Open

[설계](../plans/UC-053-received-copy-recovery.md)·UC053 A4/BR-053-05·TC050 E06/E07. 직원/그룹 받은 분석의 실제 저장 시도만 탭에 보존하고 확정 사본 조회와 미관측 요청의 재미리보기/동일 저장을 분리한다. 일반 게시 링크/모든 미전송 편집 복구로 확대하지 않는다.

## 구현·경계

현재 actor/org/원본 route/opaque session·auth epoch의 sessionStorage 티켓에 정확한 private reference+RemixSaveInput을 저장/읽어 확인한 뒤 POST한다.24h/128KiB·정확 키·UUIDv4·버전/64hex revision·매핑128열/각256자·위험 key·제외6블록/중복/128자·원본 route 일치를 검증한다. 원본 행/SQL/파일/미리보기 숫자/문서/공개 bearer token은 저장하지 않는다. d-/g- reference는 JWT 권한을 별도로 요구하는 protected 기준이며 exact digest 복구를 위해 값에만 저장한다. 새 reference를 먼저 받아 티켓을 바꾸지 않는다.

`POST /studio/received/:reference/remix-result`는 조회 전용이다. 정확 digest와 actor+UUID를 대조하고 User→실제 사본 Dashboard→target Source 부모 잠금/현재 epoch·소유·활성을 검사한다. 미관측은 User→target Source 검사다. 원본 resolver/계산/미리보기/저장/감사 쓰기를 호출하지 않고 found 여부·사본 번호/대상 source/저장 당시 revision만 반환한다. 원본 공유 회수 후에도 본인 소유 사본을 확인할 수 있지만 원본 접근은 추가하지 않는다. 내부 execution receipt 조회의 기존 용도는 유지한다.

미관측은 취소 증명이 아니다. 원래 reference·원본/lifecycle·매핑/제외·target source revision의 재미리보기→전체 결과→별도 동의→정확 UUID/body 저장을 따른다.403/409/조회 오류는 자동 버전 변경·새 UUID/사본 생성 없이 보존한다. 명시 탭 보관 해제는 서버 취소/사본 삭제가 아니다. 그룹 reference의 화면/오류/돌아가기 분류도 received 경로로 맞췄다.

설계 검토에서 재미리보기 계산 중 인증이 회수되면 집계/오류가 반환될 수 있는 경계를 발견했다. preview 시작 전·성공 응답 직전·오류 상세 반환 전 현재 epoch를 재검사하고, save도 첫 확인/최종 저장·replay 전에 User fence를 검사한다. 긴 DuckDB 계산 동안 User 잠금을 유지하지 않는다. 공유/게시 controller는 같은 서비스의 epoch 인자를 전달하며 기존 복제 의미는 유지한다.

## 선택 실행

- `node scripts/verify-semantic-mysql.cjs --received-copy-recovery`: Docker MySQL8.4.11 **14 PASS**. 실제 서비스·native DuckDB 집계/실파일과 제어한 snapshot scheduling을 사용했다. actor/digest/target binding·원본 회수 후 본인 사본 조회·조회 쓰기0·현재 소유 검사·비활성 전환 부모 잠금 대기·동시 동일 UUID 사본1개·영수증 실패 전체 rollback·result/초기 save/최종 save의 두 연결 epoch 대기를 포함한다. MySQL fixture의 원본/대상 합계는500/50이며 아래 Ego500/900과 별도다. snapshot 스케줄·버전 조회 adapter를 제어했고 실제 ConnectionService 파일 lease/다중 프로세스 경합 전체를 검증한 것은 아니다. 동시 같은 UUID는 한 service instance의 동시 호출 범위다. owned container/임시 credential/DuckDB 파일을 정리했고 persistent volume0이다.
- 신규 recovery를 최종 별도 재실행해 **30 PASS**를 확인했다. 기존 remix service/controller와 recovery 3 suites도 선택 배치에서 통과했다. 같은 배치의 conditions suite는 기존 fixture에 User metadata가 없어22개 실패했다. User entity/활성 actor seed만 보완해 conditions를 별도 재실행한 **23 PASS**를 확인했다. 초기 실패 로그를 보존했으며 전체 초기 배치를 통과로 표시하거나 여러 단계 수를 합산하지 않는다.
- FE 저장소/API/복구·received wrapper **5 files 78 PASS**, 공용 StudioRemix **11 PASS**는 별도 배치다. BE/FE type·scoped lint·build와 변경 diff 검사가 통과했다. 별도 정적 검토와 사람 업무 수용은 구별한다.

## push 전 호출자 호환성 후속

최종 호출 경로 점검에서 기존 StudioExecution의 명시 복제 저장이 새 공통 서비스 인자를 생략해 현재 JWT epoch가0보다 큰 계정도0으로 요청하는 회귀를 발견했다. controller→execution remix→공통 remix까지 요청의 epoch를 그대로 전달하도록 보완했다. 현재 DB epoch로 옛 요청을 승격하지 않는다. 현재 nonzero epoch와 옛 epoch 전달 회귀를 포함한 execution service/controller·recovery **3 suites111 PASS**는 위30개와 겹치는 후속 배치다. type/scoped lint·최종 BE build도 통과했다. 이 후속은 실제 Ego 여정 이후의 내부 호출 인자 수정이며, 해당 실행 화면 자체나 execution claim/다른 역사 경로의 모든 인증 경합을 실제 화면으로 재검증한 것은 아니다.

## Fixture 준비의 한계

한 owned QA runtime/가상 조직·직원/합성 CSV만 사용했다. 원본 amount 합계500, 수신자 별도 소스 합계900이다. 초기 SQL-only AI-save fixture는 구조화 지표 참조가 없어 복제 미지원 안내를 받았으며 제품 오류로 보지 않았다. 그 자료를 보존한 채 정상 `/bi/metrics`·`/studio/proposals`·`/studio/dashboards`로 저장 지표 참조 원본을 별도로 생성했다. 선택 저장 지표의 서버 생성 경로가 동작해 준비한 결정적 provider에 대한 modelCalls는0이었다. 실제 LLM 또는 provider 응답 검증으로 표현하지 않는다. 보존 기준은 이 준비 이후다.

## Ego112 실제 여정

한 TaskSpace/p1에서 수신자 그룹 reference로 본인 source를 선택하고 실제 숫자900·시계열 미리보기를 확인했다. 실제 save POST201 commit 뒤 XHR onloadend의 화면 전달만 네트워크 오류로 바꿨다. 사본1개/영수증1개와 frozen 티켓을 확인했다. 배경 정상 API로 원본 그룹 공유를 회수한 뒤 reload는 새 reference를 받지 않고 복구 패널을 열었다. 결과 조회 offline 실패→online 조회(found:true)→내 사본 열기→Studio reload 숫자900을 확인했다. 결과 조회 전후 사본/metric/연결/영수증 metadata는 동일했다.

원본 reference/조회는403, 현재 본인 사본은200·원 소유자는200이었다. 다른 actor의 결과 조회403·동일 UUID 다른 digest409를 실제 HTTP로 확인했다. 읽기 전용 결과는 과거 영수증의 사본 번호이며 원본 권한을 되살리지 않는다.

복제 허용을 다시 명시 설정한 뒤 별도 두 번째 저장을 offline 미전달로 실패시켰다. reload→결과 found:false→보존한 조건 전체 미리보기900→별도 동의→동일 UUID/reference/입력 POST201→새 사본 Studio/reload900을 확인했다. 결과 조회·재미리보기 동안 사본/영수증 추가0이었다. 이번 두 저장 의도에 따른 사본은 각각1개이며 같은 두 번째 요청의 배경 POST replay는 같은 사본 번호/metadata 불변이었다.

추가 미전달 요청에서 경고·동의 후 명시 보관 해제를 수행했다. 탭 key0/정상 생성 화면 복귀와 기존 사본2개/영수증2개 불변을 확인했다. 서버 취소나 이미 저장한 사본 삭제로 표현하지 않는다.

보존/HTTP **23 assertions**에서 기존8개 테이블 행은 유지되고 새 사본 행만 추가됨을 대조했다. 테이블 전체 불변은 아니다. 별도 읽기 대조에서 기존 지표 정의 행도 그대로이며 복제 지표만 추가됐다. 관리 파일8개 경로/hash/크기/mtime은 동일했다. 별도의6개 HTTP 경계 검사는 위 권한 대조 범위이며 테스트 합계로 합산하지 않는다.

found/전체 재미리보기 화면390/768/1440px에서 가로 넘침0·주요 버튼36px/14px·보조32px를 실측하고 UUID 줄바꿈·숫자/시계열·동의/버튼 정렬 캡처를 검토했다. 물리 휴대폰·전 오류/로딩 조합·실사용 데이터 규모 수용은 아니다.

## 문서 동기화·잔여

UC/BR/TC·계획·수용 잔여/AGENTS를 갱신했다. 기존 StudioRemixRequest entity와 digest/receipt를 재사용하므로 schema/migration·entity model/요구사항 ID/용어/use-case diagram은 변경하지 않았다. 선택 UC053/TC050 lint0과 전역 기존17 errors/5 warnings를 구별한다. AIWF 문서는 Draft, packet은 awaiting_review/acceptance not_recorded로 유지한다.

일반 게시 링크·소유 저장본 복제의 전면 초안 복구, 일반 member 공유 정책, 모든 writer/역할 행렬·운영/Node24·실휴대폰·사람/전체16개·TC050 수용은 Open이다. 비공개 증빙은 Git 제외이며 credential·원본 경로/기업 자료는 공개하지 않는다.
