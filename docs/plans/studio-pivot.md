# Studio 집계 Pivot 블록 통합

2026-10-18 사용자 승인: 누적 변경 커밋·push 후 기존 Pivot을 Studio 블록에 통합하고 MD 저장·게시·복제·모바일/키보드 증빙을 남긴다. P1/P3/P4/P5의 공통 블록/배치·저장·snapshot·재사용 계약을 따른다. 모델 gpt-6-luna/VoiceOver BLOCKED 유지. 이미 통과한 RXS02 계산기·기여 원본·CSV 검증은 재사용한다.

## 부족점과 최소 설계

Studio는 네 가지 차트와 SQL 위젯을 배열 index로1:1 연결한다. 집계 Pivot은 여러 지표·두 축·그룹 자격 판정이 있으므로 차트 하나로 가장하지 않는다. `SEGMENT_PIVOT` 종류를 추가하고 기존 BiSegmentService를 읽기 집계기로 재사용한다. 별도 SQL/계산 엔진·백그라운드 작업은 추가하지 않는다. 첫 범위는 저장된 segment Pivot과 기존 차트를 함께 편집하는 소유 Studio이며 일반 다축 Pivot 전체를 자동 지원한다고 하지 않는다.

블록은 안정 ID/definitionKey/title/description/measureRefs/dimensionRefs/display와 선언형 Pivot recipe(기존 strict segment view state와 catalogRevision)를 가진다. recipe는 서버가 소유 source/활성 canonical metric·정의 버전/축·필터·기간을 다시 검증하며 클라이언트 SQL/결과는 받지 않는다. 저장 보기 선택은 초안에만 추가하고 명시 미리보기·저장 전까지 DB 쓰기를 하지 않는다. 차트만 기존 analysis/widgets 경로로 보내고 Pivot은 blockId로 결과를 결합한다. 새 종류와 차트 배열 index를 혼동하지 않는다.

차트/Pivot 혼합 문서·모든 폭 배치와 recipe는 같은 metadata transaction/CAS/영수증에 저장한다. reload·직접 제목/순서/크기·undo/redo·블록 복제는 동일 문서를 사용한다. legacy snapshot에도 선언형 Pivot/배치를 보존하거나 안전하게 차단해 조용한 손실을 막는다. 기존 metric/source/배치/공유를 자동 덮어쓰지 않는다.

원격에서 추가된 document.conditions(행 조건 AST)와 segment.conditions(HAVING)는 다른 단계다. 공통 행 조건/필터/기간→그룹 자격 판정→Pivot 기여 집계 순서를 지킨다. 현재 계산기가 지원하지 않는 행 조건은 명시적으로 차단하고 범위를 무시한 숫자를 보여주지 않는다.

게시에는 canonical 집계 결과의 표시 지표/축/셀·행·열·전체 합계/생략 정보만 whitelist한다. source/metric/private recipe/SQL/원본 행/조회 토큰을 내보내지 않고 공개 화면은 snapshot만 렌더링한다. 기존 게시본 불변/동일 URL 재게시/중지·크기 한도를 유지한다.

이번 복제는 같은 소스의 저장본을 비공개로 복제해 새 dashboard/block ID와 모든 폭 배치·recipe를 보존한다. 명시 `Studio 저장본 복제`는 미저장 초안을 제외하며 원본 권한/게시를 복사하지 않는다. 기존 소스 교체·수신자 remix가 Pivot recipe를 지원하지 않으면 저장 전에 보존형 오류를 보여주고 조용히 누락하지 않는다. 다른 소스의 축·필터·기간·선택/조건 지표와 FORMULA 의존성 remap은 후속 범위다.

## 실행·종료

1. 완료: 기존 로컬269파일 변경 커밋 a9b6e04e와 원격49커밋 충돌39파일 및 추가305bc9af 충돌8파일을 합집합으로 정리했다. 빌드/전체 단위 실패 선택 재검증/영향 core를 확인하고 c13773b8까지 develop-v2에 drumcap으로 push했다. 상세 검증은 [통합 기록](../testing/rill-scenarios.md#최신-develop-v2-통합)을 따른다.
2. contract/문서 검증/혼합 블록 resolver·preview/save, source/정의 경합 회귀.
3. 저장 보기 선택/Studio 렌더러·inspector/배치·undo/복제·reload.
4. 게시 whitelist/static renderer, 같은 소스 저장본 비공개 복제.
5. MD의 고정 margin.csv 정답으로 실제 생성/저장/reload/게시/복제·390/768/1440/Tab/Enter/Escape·표 Home/End·디자인 증빙. 권한/원본 불변·추가 쓰기0을 API/DB로 대조.

SP-01 저장: 원래5차트+Pivot을 추가/제목·배치 편집→전체 미리보기→명시 저장/reload, 새 ID/원래 정의 불변·5431.25USD/5.39%. SP-02 게시: 저장본 집계 snapshot/누출0/원본 수정에도 불변·재게시/중지. SP-03 복제: 같은 소스의 새 ID·recipe/배치·정답 수치·원본/게시 불변. SP-04 반응형/키보드: 표 내부 스크롤·주요36px/도구32px·정렬/글꼴·넘침0/포커스 복귀. 실제 실행 전은 NOT_RUN이다.

운영 MySQL/실휴대폰/VoiceOver·일반 Pivot 전체/다른 소스 매핑·수신자 remix/임의 AI 문장 전체/제품 최종 수용은 별도이며 이번 선택 흐름을 통과한 뒤에만 상태를 올린다.


## 다른 소스로 혼합 복제 후속 — 2026-10-19

[승인 실행 계획](../superpowers/plans/2026-10-19-studio-pivot-source-reuse.md)과 [SPR-01~07 실제 증빙](../testing/studio-pivot-source-reuse.md)을 따른다. 소유자의 다른 DuckDB 파일로 일반 차트+집계 Pivot을 열 연결·쓰기 없는 미리보기·새 지표/비공개 사본 원자 저장·reload/영수증 확인할 수 있다. 이번 source29/30→dashboard27, 세 폭·키보드와 비공개 게시를 선택 검증했다. 위 원래 계획의 다른 소스 미지원은 역사적 상태이며 새 지원 범위는 이 후속에 한정한다. 수신자 remix·업무 의미 이식·격리 MySQL 실제 실행/운영·실기기·VoiceOver·전체 수용은 Open이다.
