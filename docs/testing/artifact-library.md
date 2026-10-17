# UC049 — 내 시각화 산출물 보관함 첫 단위

2026-10-18 · develop-v2 · Draft. 사용자의 MK AI 연동 계약 보류/VM 사내 기능 우선 지시를 따른다. [계획](../plans/UC-049.md)·[UC](../use_cases/UC-049-find-artifact.md)·[TC](../test_cases/TC-049-find-artifact.md)·[제품 순서](../strategy/internal-artifacts.md).

## 구현 범위

기존 로그인 사용자의 Dashboard 목록 응답만 제목 검색·분석/일반 유형·최근 수정/이름 정렬로 탐색한다. 검색은 NFKC·앞뒤 공백 제거·대소문자 무시 부분 일치이며 유형과 AND다. 정렬은 응답 배열을 변경하지 않는다. 조건 또는 결과 건수가 달라지면 BoardList를 첫 페이지에서 표시한다. 결과 건수/없음/초기화를 제공하고 원래 데이터 없음/목록 오류는 기존 경로를 유지한다.

기존 조회·이름 수정·삭제·분석 Studio 링크와 사용자 매핑 기반 서버 권한은 유지한다. BE/DB/게시 변경 없음·추가 검색 요청/쓰기0이다. 부서/전사 공유·즐겨찾기·보관·공식 지표·갱신형 게시·MK AI 계약은 구현하지 않았으며 이 첫 단위로 완료 처리하지 않는다. 필터는 현재 화면 임시 상태다.

## 검사

- ArtifactLibrary는 실제 BoardList 페이지 처리를 사용하고 BoardItem만 단순화한 컴포넌트 회귀다. 제목 정규화/유형 AND·최근/이름 정렬·원본 배열 불변·기존 Studio/삭제 인자·페이지2 검색→첫 페이지·결과 없음/초기화를 확인한다.
- 기존 Dashboard 진입/Studio 링크·소스 패널·게시 handoff와 실제 BoardItem 검사도 함께 수행한다. 새 결과 건수의 status 역할로 기존 단일 status 가정이 실패해, 소스 패널 테스트를 구체적인 표시 내용으로 수정했다.
- 최종3파일13개 PASS·TypeScript/변경 ESLint/Vite 빌드 PASS다. strict 명세 오류0/기존 상태 경고2/억제0이며 경고로 종료코드1이다. 로그: `/tmp/vm-artifact-library/unit.log`, `build.log`, `/tmp/vm-artifact-library-type.log`, `/tmp/vm-artifact-library-lint.log`.

## 디자인·실제 화면 제한

공통 TextField 입력/선택36px·작은 버튼32px·14/16px 반응형 폰트를 재사용했다. 모바일1열/태블릿2열/넓은 화면 가로 배치와 min-width0을 사용한다. 이는 코드상 구성이다. 실제390/768/1440 치수·정렬/키보드·삭제/Studio 이동·새로고침은 **NOT_RUN/BLOCKED**다. 기존 Ego96은 로그인 대기/사용자 인계이며 추가 계정 생성 권한은 확인되지 않았다. 브라우저 인증이나 사용자 제어를 우회하지 않는다. 실제 부서별 데이터/고객 수용/운영 검증도 별도다.
