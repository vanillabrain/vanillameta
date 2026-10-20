# UC025 브라우저 초안 복구 설계

P3/P4·UC022 실패 복구의 reload 공백을 최소 보완한다. 현재 DashboardEdit은 모든 상태를 메모리에 보관해 reload 때 사라진다. 새 서버 DB/API·의존성 없이 sessionStorage helper와 기존 편집/UC017 복구 상태를 사용한다.

보관 envelope v1: dashboardId/sourceId/baseRevision, base(title/items), draft(title/items), prompt, selectedKey/aiEditMode/layoutMode, conflict/unknownSave 및 필요 saveAttempt, updatedAt. scope는 현재 유효 로그인 토큰 SHA-256과dashboardId이며 토큰 자체는 envelope/key에 넣지 않는다. 같은 actor라도 재로그인은 별도 scope다. 탭 종료·실기기/다른 기기·브라우저재시작은 범위 밖이다.

저장소는 신뢰하지 않는다. 24시간/256KiB·판별 스키마·블록 최대6·ID/기본 타입·문자열/배치 한도를 검사하고, 복구한 초안은 일반 validItems/server preview/CAS를 다시 통과해야 한다. 브라우저에는 정의(SQL 포함)가 남을 수 있으므로 안내한다. 데이터 행/preview·비밀정보·실행 의도 영수증은 보관하지 않는다. quota/비활성/손상/만료에 대한 단위·UI 검사와 세션/분석 범위 분리를 검증한다.

권한 있는 editor 조회가 먼저다. 보관 후보를 발견하면 명시 복구/폐기 전까지 자동 덮어쓰기·편집 실행을 막는다. 복구 시 같은 revision이면 메모리 초안만 복원하고 preview/history를 초기화한다. revision다름은 oldbase+local을 UC017에 넘겨 conflict 상태로 시작하고 최신본을 확인한다. unknownSave는 그대로 읽기 상태 확인을 요구한다. source다름은 복구 불가, 명시 폐기만 허용한다. 복구 자체는 서버 쓰기0이다.

useEffect의 hydration/route key 경계를 분리해 최초 빈 폼·이전 route가 보관본을 덮어쓰지 않도록 한다. 저장 확인 후 key를 제거하고 autosave를 중지한 뒤 navigate한다. 명시 최신본 초기화는 해당 key만 지운다. 로그아웃은 이 기능 prefix만 정리하며 사용자 sessionStorage의 다른 값은 유지한다.

UI는 기존 Notice/Button·36px/도구32px를 사용한 작은 복구 패널이다. 실패/새로고침→복구→실제 재질문→미리보기→저장→게시/reload, 원본·비대상·배치 보존과390/태블릿/1440 정렬/넘침을 Ego로 확인한다. 반복 무변경 생성은 기존 저장소 밖 주입 래퍼로 재현하며 복구는 실제 Codex을 사용한다.

정상 인증 refresh 성공 시에만 토큰 hash와 기존 scope의 별칭을 같은 탭에 이어 붙인다. 원 토큰은 별칭에도 저장하지 않으며 새 로그인·로그아웃은 이전 초안/별칭을 제거한다. 다른 탭이 토큰을 갱신하는 경합은 후속 검증 범위다.

통합 후 실제 재질문에서 suffix/prefix 등 빈 기본 표시 옵션의 생략이 변경으로 판정되는 UC022 공백을 확인했다. 동일성 비교는 검증된 정의의 키 합집합과 기본값(prefix/suffix/category 빈값·decimalPlaces0·numberNotation full)으로 수행한다. 실제 수치/제목 변경은 별도 확인하며 SQL 의미 전체 동치 판별은 추가하지 않는다.

실제 후속 질문에서 모델이 제목 변경과 함께 선택 숫자를 다른 차원의 막대 정의로 바꾸는 응답도 관찰했다. 미리보기에서 발견해 저장하지 않았다. 원 질문에 ‘제목만/이름만’이 명시된 경우에는 내부 renameOnly 계약으로 선택 블록의 기존 계산·차트·표시를 서버에서 보존하고 생성 결과의 제목만 반영한다. 이는 명시적 제목-only 범위이며 일반 내용 수정/미지원 자연어 의미 판별을 확장하지 않는다. 보존 회귀와 실제 재질문으로 확인한다.
