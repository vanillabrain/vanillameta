# UC-017 설계 대조

2026-10-15, Draft, 별도 native executor 읽기 리뷰 후 main 수정. 승인 아님.

- 요구사항은 FR009·NFR001/003/004로 연결한다. 최초NFR002숫자정확성연결을바로잡았다.
- GET editor는소유권검사후 실제materialized widget의savedDefinition을반환한다. structured metric snapshot을대신반환하지않는다. 저장body는여전히savedDefinition을whitelist하지않는다.
- 같은단위의충돌은목록에번호/제목/필드명을표시하고전체충돌항목에내변경을한번명시한다. 개별서버/로컬혼합선택은이번범위가아니다.
- 결과불명확은응답없는통신오류/timeout/5xx이며409와확정4xx거절을구분한다. 미확인저장의자동재시도는없다.
- 합친초안은표시/배치를다시검사하고preview/이력을해제한다. 전체서버preview전저장은불가하다. metric materialization·표시정규화·실제SQL/연결차이는순수helper회귀로대조한다.
- 구조변경자동병합·모든지표활성상태전환·운영/실기기·브라우저종료후영구초안은미완료다. 정의가없으면동일저장으로추정하지않는다.

구현중독립리뷰가봤던helper부재는병렬작업중시점이며완료증거가아니다. 실행결과는TC017과검증기록을따른다.
