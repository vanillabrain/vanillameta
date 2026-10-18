# UC054 출력 결과 알림 검증

[계획](../plans/UC-054-export-notifications.md)은 출력의 확정 완료/실패/취소 감사 사건을 기존 본인 알림함에 투영한다. 파일 상태를 새로 쓰거나 외부 메시지를 발송하지 않는다. FR022/023·NFR005/007/008의 부분 구현이며 전체16개 수용은 미완료다.

## 권한·정확성·복구

현재 활성 본인과 현재 조직, export 사건의 subject/actor 모두 본인인 경우만 최소 사건 metadata를 읽는다. resourceKind는 export, resourceId는 작업 ID, version은 사건 당시 작업 버전이다. 접수/실행 중·다른 actor/조직/본인 아닌 사건은 제외한다. source/dashboard 권한·직접/그룹 공유의 기존 투영은 유지한다. 읽음/목록 제거는 본인 상태만 변경하며 감사/작업/파일을 보존한다.

실제 SQLite·DuckDB·JWT를 포함한 선택 BE2 suites/29개가 PASS했다. 새 결과 사건의 종류/번호/버전·응답 필드·조직 경계와 읽음/제거의 단방향 보존을 service 직접 호출로 검증했다. JWT HTTP 검사는 알림/작업 각 보호 경로의 회귀와 새 출력 알림의 조회/읽음/제거를 포함한다. 새 export 사건의 모든 경계를 별도 HTTP로 실행했다고 해석하지 않는다.

실제 DuckDB 집계 완료/실패/취소→알림 투영, 반복 실행/취소의 사건 추가0, 타 계정 본인 알림 비노출을 확인했다. 알림 읽음/제거 뒤 완료 CSV가 같고, 실제 SQLite 알림 state 테이블을 임시 rename해 목록 조회 실패를 일으켜도 완료 CSV는 보존된다. 테이블은 finally로 복원했다. 수신자 export grant 회수 후 파일 API는403이며 과거 실패 알림/기존 파일 조각은 남는다. 알림을 현재 파일 권한 증거로 사용하지 않는다.

## 화면·수용 경계

접힌 기존 본인 알림함에 파일 작업 번호와 완료/실패/취소를 표시한다. 자동 실행/다운로드와 소스명·SQL·CSV·오류 원문·공유 URL 노출은 없다. Enterprise FE9 suites/104개가 PASS했다. 출력 결과 세 종류의 표시/읽음·제거와 잘못된 kind/event 조합·export의 그룹 표식 거절, 기존 권한/공유·그룹 알림을 포함한다. 양쪽 type/scoped lint/build도 PASS다.

실제 Ego96은 사용자 제어 상태이며 새 화면·390/768/1440 실측·실휴대폰·MySQL/운영·사람 수용은 NOT_RUN이다. 직전 출력 작업의 BE236/FE278/core8은 역사적 증빙이며 이번 실행 수에 합산하지 않는다. [전체 완료 목표](../plans/enterprise-completion.md)·TC050 전체는 계속 열린다.

알림 API도 JWT epoch를 큐 진입 후 재검사하고 no-store로 응답한다. 오래된 epoch의 조회/읽음은 상태 쓰기0·401이며 새 epoch는 정상 조회된다. 실제 JWT HTTP의 export 사건 조회/읽음/제거와 no-store도 선택 검증한다.

독립 native code-reviewer(Sol)는 BE/FE·계획8개 파일의 수신자/조직/인증 경계, 최소 투영, 유형 조합, 과거 결과 안내·명시 읽음/제거를 검토해 추가 지적0/한정 변경 승인으로 보고했다. reviewer는 scoped lint/공백을 독립 실행했으며 위 runtime/컴포넌트 결과는 Main이 확인했다. 사람 수용/운영 승인은 별도다.
