# UC051 업무 자료 선택·인계 의향 검증

Status: Draft

## 범위와 경계

[설계](../plans/UC-051-handover-proposal.md)·UC051 A4/BR05105·TC050 E02/E03의 의향 요청이다. 비교 기준은 develop-v2의7bf8061e 이후 선택 구현이다. 본인 source/dashboard의 제목·번호만 수신자에게 공개하며, 수락도 실제 소유권/접근권/파일/퇴사 상태를 변경하지 않는다. 외부 메시지 자동 발송은 없다.

## 실행 기록

### 구현·자동 검증

- 새 의향 entity와 additive migration1792600000000, 보호 controller/service·후보 조회/생성/상태/수락/철회, 일반 구성원용 접힌 화면을 추가했다. 기존 자산 소유·관계·파일·소속은 변경하지 않는다.
- 실제 Docker MySQL8.4.11: **62 PASS/4.570초**(`mysql.log`). 후보 격리/중복 mapping·현재 epoch/조직/metadata·정확한 제목 검증, 공개 중단·historical replay, 같은 UUID 동시 생성/수락·철회 CAS, 두 연결의 Source/Dashboard 부모 writer 선후 순서·자식 변경 잠금, 감사/상관관계 late rollback·migration 반복/불일치 중단을 확인했다. 컨테이너·임시 credential cleanup을 확인했으며 운영 적용이 아니다. 최초 MySQL55 PASS/1 FAIL은 테스트용 TypeORM changeColumn이 기존 reviewBasis 값을 비운 뒤 snapshot 비교에 실패한 것이다. 값 보존형 fixture DDL로 바꿨고 제품 migration이 원본을 변경한 실패로 계산하지 않는다. 최초 로그는 mysql-initial-fixture-ddl.log에 보존했다.
- SQLite 서버 선택3 suites **100 PASS/9 SKIP,4.151초**(`sqlite.log`)는 새 handover와 기존 departure-impact/staff-transfer를 포함한다. MySQL 전용9개 SKIP이며 MySQL62와 합산하지 않는다.
- 최종 FE 통합3 files **49 PASS/1.46초**(`frontend-integrated-tests.log`)는 API/화면/조직 화면 경계를 확인한다. 최초45개와 후속 화면19개는 겹치므로 합산하지 않는다. 명시 요청·정확한 응답 shape·소유 범위·늦은 응답/unmount·미확정 생성의 고정 UUID/전체 제목 보존·404 뒤 동일 요청 명시 재시도·4xx 거절과 미확정 결과 분리·검토/동의 초기화를 포함한다.
- BE type/scoped lint(`type.log`,`lint.log`는 backend command header), Main BE build(`backend-build-final-current.log`)·FE type/scoped lint/build(`frontend-*.log`)가 통과했다. FE 최종 build1.44초다. 양쪽 agent의 초반 공용 로그 이름이 겹쳤으므로 최종 FE 전용 로그와 BE header를 구분해 사용한다.

### 독립 검토·보완

독립 analyst의 설계 검토4건은 확인한 제목 바인딩, 상태 조회와 제목 공개 자격 분리, 응답 유실 뒤 과거 수락/현재 상태 분리, 공통 부모 잠금/READ COMMITTED로 반영했다. code-reviewer Gauss의 최초 MEDIUM2건(감사 UUID 상관관계·결정4xx를 미확정으로 처리)을 수정했다. 생성/수락/철회의 정확한 audit ID를 같은 transaction에 연결하고 응답에 노출하지 않는다. 명시4xx는 입력/요청 번호를 보존하며 검토/동의를 해제하고 GET 재검토 전 재전송하지 않는다. 후속 정적 재검토는 **APPROVE/잔여 finding0**이며 리뷰어가 runtime/MySQL/Ego를 재실행한 것은 아니다. 사람 수용이 아니다.

### Ego103 실제 화면

분리된 임시 SQLite QA 서버, 합성 계정/조직·metadata-only 소스/대시보드201을 사용했다. 실제 MySQL 앱 서버의 UI로 표현하지 않는다. 다음 여정을 실제 UI에서 확인했다.

1. 일반 구성원 소유자로 로그인→본인 소스/대시보드 후보 조회→각1개 선택→수신자 직원 번호·정확한 제목/번호 공개 동의.
2. 배경에서 합성 소스 제목을 바꿔 생성409·요청 행0·미확인 새 제목 비공개·선택2개/입력 보존·명시 거절 안내를 확인했다. 이 배경 fixture 변경을 실제 소스 편집 UI/두 탭 동작으로 계산하지 않는다.
3. 제목을 원복하고 후보를 다시 확인/선택한 뒤 새 요청 명시 저장201·고정 목록2개를 확인했다. 원문 경로·계산식 sentinel 비노출이다. 미저장/미확정 번호에 전달 안내가 나오던 문구를 수정해 저장 확인 전에는 상태 확인을 안내한다.
4. 실제 로그아웃/지정 수신자 로그인→요청 번호 입력/명시 검토→수락 직전 배경 metadata 변경→실제409·미확정 안내 없음·이전 검토 폐기·요청 번호 유지.
5. 합성 제목 원복→명시 GET 재검토/재동의→수락201/version2→브라우저 reload→같은 번호 명시 조회로 과거 수락/고정2개 확인. 새로고침이 요청을 자동 수락하지 않는다.
6. 소유자로 재로그인→같은 번호 검토/철회201/version3→reload/명시 조회 뒤 철회 상태·assets0/제목 비공개를 확인했다. 수락/철회는 원본 접근권이나 이전을 실행하지 않는다.

별도 실제 앱 API는 owner/recipient200, 일반 admin/타 조직403, 미로그인401이었다. 철회 뒤 expectedVersion1의 동일 수락 재시도는201/현재cancelled version3·제목0을 반환했고 감사 사건은 총3개 그대로였다. 이는 실제 API 재시도 검증이며 브라우저에서 commit 응답 본문을 유실시킨 시험은 아니다. 원본/소속/권한 등60개 보호 테이블의 전후 hash가 같았고, 의향·감사·로그인/세션·migration은 비교에서 구분했다(`preservation.json`). 실제 생성/수락/철회3개 audit 연결도 조회 확인했다.

| 폭   | 선택/후보 조회·요청 번호/검토 버튼 | 입력 폰트 | 같은 행 상단 차         | 가로 넘침 |
| ---- | ---------------------------------- | --------- | ----------------------- | --------- |
| 390  | 모두36px                           | 16px      | 세로 배치44px=36+8 간격 | 0         |
| 768  | 모두36px                           | 16px      | 각0px                   | 0         |
| 1440 | 모두36px                           | 14px      | 각0px                   | 0         |

수신자의 저장 기록 대표 화면을 세 폭에서 측정했고 Main이 초기/최종 세 스크린샷을 열람했다. 상세 한계는 접혔으며 화면의 UUID 용어는 ‘요청 번호’로 바꿨다. 수신자에게 불필요한 전달 안내도 현재 기록 재조회 안내로 정리했다. 긴 번호는 input 내부 가로 이동을 사용하며 페이지 가로 넘침과 구분한다. 실제 휴대폰/터치/소프트 키보드·전체 접근성 수용이 아니다.

처음 로그인은 Bitwarden 자동완성 제안이 버튼을 가려 실패했고 Escape로 제안만 닫아 같은 Ego 공간에서 계속했다. 개발 중 HMR로 접힌 패널의 예전 선택자를 찾지 못한 시도도 현재 화면 확인 후 복구했다. 새로운 공간이나 우회 클릭을 사용하지 않았다. Node22.23.1 실행이며 지정 Node24 운영 호환성 검증은 아니다. Ego103은 최종 finish했고 임시 서버·credential은 정리했다.

### 문서 경계

UC051 A4/BR05105·entity_model·TC050 선택 시나리오·완료 계획/수용 점검/AGENTS를 동기화했다. 새 actor/최상위 요건 ID를 추가하지 않아 use_cases.puml/requirements/glossary는 변경하지 않았다. FR016/FR017·전체16개/TC050 상태는 승격하지 않는다. AIWF pin/packet은 검토 준비와 문서 내용 확인이며 사람 승인/전체 제품 수용이 아니다.

## 잔여

전체 의존성 고정·파일 보관·소유권 이전/복제·퇴사/탈퇴 확정·조직 없는 계정 삭제 보호 해제는 후속이다. 현재 내부 fingerprint는 metadata 검토용으로 외부 파일 bytes/DB 상태를 증명하지 않으며 실제 이전 ticket으로 사용하지 않는다. 운영 migration·실휴대폰·전체16개 요건/TC050·사람 수용은 미완료다.

최종 build 후 실제 UI에 사용한 서버 JS와 최종 JS의6개 관련 module을 주석 제거/정규 출력으로 비교해 차이0을 확인했다(`served-js-comparison.json`). 소스 파일 수정 시각이 뒤인 것은 이 비교와 구분하며 최종 코드가 다른 상태의 과거 UI 증빙으로 승계하지 않는다. 선택 UC051/TC050 lint는 각0 errors/0 warnings, 전역 strict는 기존 중복 ID/상태 문제17 errors/5 warnings로 실패하며 전체 문서 통과로 표현하지 않는다.

원격 cb442029의 게시 화면 키보드 포커스 수정을 보존해 통합했다. 인계 서버/공통 UI Kit은 이 원격 변경에 포함되지 않았다. 통합 후 인계3개 파일49개와 변경된 게시 파일1개를 포함한 FE4 files50 PASS/1.66초·type/build(978ms)를 확인했다. 이전49개와 중복 합산하지 않는다. 실제 Ego 여정은 통합 전이며 인계 화면 코드에 새 동작을 추가한 통합으로 표현하지 않는다.
