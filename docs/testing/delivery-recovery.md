# UC053 직원 공유 요청 새로고침 복구 검증

Status: Selected verification passed; full acceptance Open

[설계](../plans/UC-053-delivery-recovery.md)·UC053 A2/BR-053-03·TC050 E06/E07을 따른다. 직접 직원 조회 공유/회수와 독립 복제 허용 설정의 frozen 요청 보존 단위이며, 그룹 공유·독립 사본 생성 자체의 미확정 요청 복구를 완료로 표시하지 않는다.

## 구현과 검토

전송 전에 sessionStorage에 UUID/정확 입력·actor/org/dashboard·시각을 검증 저장하고 읽어 확인한다. 같은 session/auth epoch만 복구하며24h/8KiB/50명/UUIDv4·CAS·정확 키를 검사한다. 저장소 오류는 새 쓰기를 차단한다. 접기/화면 이동/reload는 요청을 보존하며 자동 POST0이다. 최신 GET 성공은 과거 UUID의 저장 결과가 아니므로 티켓을 지우지 않는다. 명시 재시도 동의는 미전달 요청의 최초 쓰기를 수행할 수도 있다. 완료/역사 영수증 뒤에도 새 쓰기는 현재 관계를 다시 읽어야 한다. 보관 해제는 탭의 단서 제거이며 서버 취소가 아니다.

별도 검토에서 직접 전달 POST가 JWT guard 후 User 잠금을 기다리는 동안 바뀐 epoch를 재검사하지 않는 HIGH를 발견했다. controller가 authVersion을 전달하고 기존 정렬 User/Membership 잠금 뒤·현재 정책/영수증 조회 전에 `lockSourceActor`를 적용했다. 이전 token으로 역사 영수증만 반환하는 것도 허용하지 않는다. 직접 전달 외 다른 writer의 현재 신원 검사를 모두 완료했다는 뜻은 아니다.

공개 spec의 UC/BR/TC·계획·수용 잔여를 동기화했다. 기존 영수증·감사 entity와 API 응답 형태를 재사용하므로 entity model/요구사항 ID/용어/전체 use-case diagram의 변경은 필요하지 않았다. 새 서버 schema/migration은 없다.

## 선택 테스트

- 고정 `node scripts/verify-semantic-mysql.cjs --delivery-recovery`: 실제 Docker MySQL8.4.11 **7 PASS / 18 범위 밖 SKIP**. 동일 요청 동시성·정확 replay/변경 body409·회수 후 과거 replay·부분 수신자 CAS rollback·source read 누락 rollback·복제 동의 보존과 신규/역사 요청 두 종류의 epoch 대기를 포함한다.
- 두 연결에서 실제 JWT guard 통과→User 잠금 대기 확인→다른 연결 authVersion 증가→옛 요청403·관계/감사/영수증/대상 원본 쓰기0을 확인했다. 현재 epoch controller 요청은 성공한다. Promise 시작 순서와 MySQL 잠금 승자 순서가 같다고 가정한 초기 테스트 오류는 순서 독립 assertion으로 보완했고 실패 로그를 보존했다.
- 같은 delivery spec SQLite **23 PASS / 2 MySQL 전용 SKIP**, 별도 epoch/controller **4 PASS**. MySQL과 겹치므로 합산하지 않는다. owned Docker container/임시 credential은 정리했고 persistent volume0이다.
- FE 저장소/API/컴포넌트 **57 PASS**, 부모 ResourcePolicies **16 PASS**. type/scoped lint·BE/FE build 통과. 후속 UUID 대소문자 검증 **1 PASS / 19 필터 제외**는 별도 로그이며 기존 배치와 겹친다. 최종 FE build도 통과했다.

## Ego110 실제 여정

한 TaskSpace/p1에서 가상 소유 admin·가상 직원과 실제 CSV upload/정상 AI-save API의 합성 분석만 사용했다. fixture의 AI-save는 저장 API 계약이며 실제 LLM 실행 증거가 아니다. 직원에게 source read만 직접 부여하고 dashboard grant는 주지 않았다.

실제 공유 POST가201로 commit한 뒤 XHR onloadend의 화면 전달만 네트워크 오류로 바꾸었다. DB에는 active1/version1·영수증1·감사1건이 추가됐고 UI는 미확정 요청을 유지했다. 접기/펼치기와 reload 후 같은 UUID/입력이 복구됐으며 재시도 checkbox는 미체크/비활성이었다. 현재 관계 GET의 offline 실패에도 요청은 유지됐다. online 재조회→별도 동의→같은 UUID/CAS/body POST201(replayed=true)를 확인했다. commit 직후/reload/역사 replay 사이 관계·영수증·감사는 동일했다.

그 뒤 명시 회수 POST를 offline 미전달로 실패시켰다. reload→최신 GET→동의→동일 요청 재시도는 최초 쓰기로 성공해 active0/version2·영수증2·감사 합계2건이 됐다. 과거 공유 UUID를 배경 API로 다시 확인해 역사 active:true 응답과 현재 GET active:false/version2가 함께 유지됨을 대조했다. replay 후 감사/영수증/관계 추가0이다.

추가 offline 공유 요청을 별도로 만든 뒤 경고를 펼쳐 명시 보관 해제를 수행했다. 탭 pending key0·서버 active0/version2·영수증2/감사 상태 불변을 확인했다. 이는 실행 취소가 아니며 해당 추가 요청은 서버에 도달하지 않았다. 최종 복구 패널 캡처는 실제 패널 전체가 보이도록 스크롤한390/768/1440px에서 다시 저장했다.

17개 보존/HTTP assertions로 원본 관련8개 테이블(소스·대시보드·mapping·위젯/데이터셋·Studio·직접 grant) 불변, 관리 파일5개 경로/hash/크기/mtime 불변을 확인했다. 회수 직원의 대시보드는403, 별도 source read는200, 원 소유자는200이다. 이 fixture에 기존 독립 사본은 없으므로 실제 사본 보존 전체 여정으로 확대하지 않는다.

복구 패널의390/768/1440px 가로 넘침0, 주요 버튼32px·14px를 실측했다. 수신자 이름/UUID의 줄바꿈과 동의/버튼 배치는 실제 캡처로 확인한다. 실휴대폰 터치·전 오류/로딩 상태 조합·운영 데이터 규모 검증은 별도다.

## 한계와 잔여

그룹 공유·독립 복제 저장 요청의 reload 복구, 일반 소유 member 공유 정책, 모든 writer의 epoch/보호 경로 행렬, 운영/Node24·실휴대폰·사람 및 전체16개/TC050 수용은 Open이다. AIWF 문서는 Draft, packet은 awaiting_review/acceptance not_recorded로 유지한다. 전역 문서 lint의 기존17 errors/5 warnings와 이번 UC053/TC050 선택 lint0을 구분한다. 비공개 실행 로그/캡처는 Git 제외 증빙에 보관하고 credential/사적 경로/기업 자료를 공개 커밋에 넣지 않는다.
