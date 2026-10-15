# UC-016 설계 대조

2026-10-15 / Draft / 독립 native executor의 읽기 대조와 main 수정. 승인 아님.

별도 리뷰에서 기존 UC013/014/015의 다중블록clarify/strict3 설명과 새 batch 계약의 연결 누락, 실패position·폭 범위 명시, 저장transaction의 중간실패 증거 부족을 지적했다. 기존 문서에 UC016 확장 링크를 추가했고 batch만 strict actions 스키마, 기존 단일strict3는 유지한다. position은현재items1-based·모든배치action은단일layoutMode다. TC는 실제SQLite 두번째widget연결쓰기실패와includeRevision재조회 불변, 저장409/응답유실과 혼합batch를 명시한다.

실제 소스 saveEditor→AiDashboardService.save는 전체compile 뒤 한 번의manager.transaction/persist와revisionCAS를 사용한다. 기존CAS충돌테스트만으로 중간쓰기rollback을 증명하지 않는다. 후속실제SQLite trigger중간쓰기실패테스트가PASS했고6종엔티티count·revision을포함한분석전체가보존됐다. 기존생성/preview는읽기이며 별도DB/엔티티/의존성은추가하지않는다. FR009에전체preview/원자저장/부분실패복구 범위를 연결했다.

LLM이 원문의 의미를 완벽히 보존하는 것은 보장하지 않는다. 원문substring 참조·현재key검증·중복차단은 적용대상을 제한한다. 실제대표질문과 실패복구를 통과해도 모든문장·운영DB·전체P3완료를 뜻하지않는다.

별도FE리뷰후main은HTTP errorMessage재사용·저장전요약문구·no-op안내와회귀를보강했다. 실제후속에서발견된LLM제목드리프트는batch내용action의명시rename외기존제목보존으로수정하고단위/실제질문→저장/reload를재검증했다. 독립재승인은주장하지않는다.
