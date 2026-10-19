# UC053 그룹 공유 요청 새로고침 복구 검증

Status: Selected verification passed; full acceptance Open

[설계](../plans/UC-053-group-delivery-recovery.md)·UC053 A3/BR-053-04·TC050 E06/E07. 동적 그룹 조회 공유/회수·독립 복제 허용 설정의 미확정 요청 복구 단위이며 독립 사본 생성 요청 복구와 전체 FR021 수용은 별도다.

## 구현·검토

직접 공유와 다른 prefix의 탭 저장소에 actor/org/dashboard/session epoch·시각·정확 UUID/그룹 번호/두 버전/설정을 전송 전에 검증 저장한다.24h/8KiB·소문자 UUIDv4·정확 키·정수 버전·회수/복제 조합을 검사하며 이름/SQL/원본/token/링크는 저장하지 않는다. 저장소 실패/손상/만료는 자동 쓰기 없이 경고·차단한다. 접기/reload와 최신 GET 성공,403/409도 미확정 티켓을 지우지 않는다. 현재 관리 조회→별도 동의→원래 UUID/그룹 버전/CAS/body로만 재시도하며 영수증 없으면 최초 쓰기를 수행할 수 있다. 명시 보관 해제는 서버 취소가 아니다.

그룹 POST의 User 잠금 후 epoch 누락을 확인해 controller가 authVersion을 전달하고 기존 groupAdmin 잠금 뒤·policy/receipt 앞에 현재 active/epoch 검사를 추가했다. 공통 그룹 CRUD/transaction과 다른 writer는 변경하지 않았다. 영수증 replay는 현재 관리 권한을 검사한 뒤 그룹 버전/활성/CAS보다 먼저 역사 결과만 반환한다. 최초 공유는 현재 그룹 버전/CAS를 검사하고 비활성 그룹 회수는 기존대로 허용한다.

UC/BR/TC·계획·수용 잔여를 동기화했다. 기존 entity/영수증/감사와 응답을 재사용하므로 새 schema/migration·entity model/용어/요구사항 ID/use-case diagram 변경은 없다. 별도 설계·통합 코드 검토의 consequential finding0/APPROVE와 사람 업무 수용을 구분한다.

## 선택 실행

- `node scripts/verify-semantic-mysql.cjs --group-delivery-recovery`: 실제 Docker MySQL8.4.11 **6 PASS / 22 범위 밖 SKIP**. 정확/역사 replay·다른 body/도메인 충돌409·그룹 변경409·원자 rollback과 신규/과거 영수증 두 종류의 User 대기 경합을 포함한다.
- 실제 JWT guard 통과 후 다른 연결이 User를 잠그고 epoch를 증가시킨다. 대기한 old epoch 요청은 신규 저장·역사 replay 모두403이며 관계/감사/영수증/원본 변경0이다. 현재 epoch controller 요청은 정상 처리한다.
- 같은 spec SQLite **24 PASS / 4 MySQL 전용 SKIP**, 별도 group auth/controller **4 PASS**. MySQL과 겹치므로 합산하지 않는다. owned container/임시 credential을 정리했고 persistent volume0이다.
- FE 저장소/API/컴포넌트 **51 PASS**, 부모 ResourcePolicies **16 PASS**. type/scoped lint·BE/FE build 통과. 이전 직원 공유·다른 slice 테스트 수와 합산하지 않는다.

## Ego111 실제 화면

한 TaskSpace/p1에서 가상 소유 admin/직원·합성 CSV upload와 정상 AI-save API로 저장한 분석을 사용했다. 직원 source read는 별도 직접 grant, 그룹 가입은 정상 API로 만들었다. AI-save는 저장 API 계약이며 실제 LLM 실행 증거가 아니다.

실제 그룹 공유 POST201 commit 뒤 XHR onloadend의 화면 전달만 네트워크 오류로 바꾸었다. 관계 active1/version1·영수증1·감사1건 추가와 UI의 미확정 UUID/정확 입력 보존을 확인했다. 접기/펼치기→reload→현재 조회 offline 실패→online 재조회→별도 동의→동일 POST201(replayed=true)를 수행했다. commit 직후/reload/replay 사이 관계·영수증·감사는 동일했고 복구 직후 동의는 미체크/재시도 비활성이었다. 이때 그룹을 통한 직원 대시보드 조회는200이다.

독립 복제 허용 설정 변경을 offline 미전달로 실패시켜 원래 groupVersion2/관계Version1 요청을 보존했다. 배경 정상 API에서 그룹 이름을 변경해 version3으로 만든 뒤 reload→최신 GET→별도 재시도는 원래 버전2로409를 받았다. UUID/body/복제 설정을 그대로 보존하고 관계/영수증/감사는 변경하지 않았다. 현재 버전을 frozen 요청에 자동 적용하지 않았다.

409 패널을390/768/1440px에서 캡처·실측하고 명시 보관 해제 경고/동의를 거쳐 탭의 요청만 제거했다. 최신 조회로 새 초안을 만들어 그룹 조회 공유 회수를 명시 저장했다. 과거 성공 공유를 배경 API로 replay해 역사 active:true 응답과 현재 active:false/version2를 함께 확인했고 관계/감사/영수증 추가0이었다. 물리 휴대폰·전 오류/로딩 조합·실제 독립 사본 fixture는 사용하지 않았다.

16개 보존/HTTP assertions로 원본8개 테이블(소스/분석/mapping/위젯/데이터셋/Studio/직접 grant)과 관리 파일5개 경로/hash/크기/mtime 동일성을 확인했다. 그룹 회수 뒤 직원 대시보드403, 별도 source read200·소유자200을 대조했다. 실제 독립 사본 fixture가 없어 전체 사본 보존 여정으로 확대하지 않는다.

대표390/768/1440px에서 가로 넘침0·그룹 선택36px/16·16·14px·도구 버튼32px/14px를 실측했다. 실제409 패널 캡처의 UUID/설정 줄바꿈과 checkbox/버튼 정렬을 검토했다. 회수 저장 후 reload/최신 조회의 active=false·미확정 티켓 없음도 확인했다.

## 잔여·한계

독립 사본 생성 요청의 reload 복구, 일반 member 공유 정책, 전 writer/역할 경계와 운영 migration·Node24·실휴대폰·사람/전체16개·TC050 수용은 Open이다. AIWF 문서는 Draft, packet은 awaiting_review/acceptance not_recorded다. 선택 UC053/TC050 lint0과 기존 전역17 errors/5 warnings를 구분한다. 비공개 로그/캡처는 Git 제외 디렉터리에 보관하고 credential/기업 원문/사적 경로는 공개하지 않는다.
