# UC-018 게시 snapshot 검증

2026-10-15, `0bdb967c` 위 UC018 변경, P4/FR011. UC/설계/TC/계획을 먼저 작성하고 별도 native executor 의미 리뷰 뒤 whitelist·응답 envelope·중지후새URL·삭제/상태코드·entity 계약을 보완했다. Draft이며 테스트·pin·독립리뷰·사람승인·운영배포·전체제품수용은 별개다.

## 구현 범위

소유 저장화면의 `게시 버전`에서 전체 기간·필터 없음·UTC의 고정 집계 결과를 미리보고 명시 링크 게시·재게시·중지를 실행한다. 서버 ticket은 5분/100개/20MiB한도로 owner/dashboard/revision/집계결과에 묶인다. source 접근·기존 분석/preview compiler와 transaction/CAS를 재사용한다. 같은 마지막 성공 requestId+digest는 버전을 늘리지 않는다. 활성 재게시의 URL은 유지하고 중지·만료 후 게시에는 새 UUID를 사용한다. 원본 저장 정의와 게시 결과를 분리하며 기존 live share/embed는 바꾸지 않았다.

공개 응답은 whitelist 표시 정의·선택한 value/category scalar·시계열·논리 배치만 포함한다. SQL/queries/fields/databaseId/소스경로/인증/원본상세는 없다. 기존 compileContribution으로 안전 집계가 확인된 블록만 허용한다. 단순 읽기전용 SELECT가 곧 집계인 것으로 추정하지 않는다. 공유 집계 증명기의 제한으로 표시그룹240개를 넘거나 미지원SQL이면 거절한다. sanitizer 자체한도2000행/240추세점/1MiB보다 더 제한적일 수 있다. SQLite 최대1MiB, 현재 MySQL TEXT는60KiB추가한도다. 운영MySQL 실행은 미검증이다.

## 실제 Ego 기능

기존 실행환경3698/4899→4898·SQLite `/tmp/vm-rill-views/metadata.db`, 공개 Rill소스7, 사용자가 임시공유검증을 허용했던 분석12를 사용했다. 별도 새 데모서버나LLM모델은 추가하지 않았다. 기존 Codex설정은 유지했으며 이번 게시흐름은LLM을 호출하지 않는다.

| TC      | 실행                                             | 결과                                                       |
| ------- | ------------------------------------------------ | ---------------------------------------------------------- |
| TC01802 | owner 미리보기→링크게시→인증없는GET/공개화면     | version1·숫자2+각169개추세·OS차트·범위/시점/만료 표시 PASS |
| TC01803 | 저장화면에서 제목만수정→미리보기/저장→공개reload | 공개 version1의이전제목/결과 유지 PASS                     |
| TC01803 | 새게시preview→명시재게시→공개reload              | 같은URL version2·새제목 PASS                               |
| TC01805 | 게시중지→공개reload/인증없는GET                  | version3·404 PASS                                          |
| TC01803 | 중지뒤새preview/재게시                           | version4·새URL·과거URL404 PASS                             |
| TC01804 | 실제version4의같은requestId/body 재호출          | 201영수증·version4불변 PASS(API, 응답유실주입은아님)       |
| TC01805 | 마지막UI게시중지→공개reload                      | version5·404 PASS                                          |
| TC01806 | owner390/768/1440·공개390/768/1440               | 28px일반버튼/12px글꼴·32px입력·넘침0 PASS                  |

대표캡처를 직접확인했다. 공개화면의숫자+추세와간격·기간라벨은함께보이고표/차트는원본조회기능과연결하지않는다. 초기공개main의가운데shrink-to-fit을발견해width100%/border-box로고쳤고1440px재캡처에서카드666px/전체1344px를확인했다. 사용자기존배치의빈행·열은유지한다. 읽기grid는기존분석화면처럼minmax(80px,auto)이므로내용에따라행높이가늘어난다. 편집캔버스와pixel동일주장은아니다.

## Rill 수치/디자인 비교

9009가연결거절이라기존 `/Users/drumcap/workspace_vanilla/my-rill-test-project`를리셋없이동일포트로다시실행했다. Ego같은TaskSpace26의p2에서전체기간/필터없음 requests·avg_bid_floor·device_os를읽어약635M/$5.57과KPI아래추세를비교했다. VM snapshot의정확요청수634513000·평균5.571238676523274는기존공식Parquet oracle평균5.571238676526892와상대오차1e-9이내다. 재게시재집계때평균/추세약1e-14차이도허용오차로대조했다. Rill데모는재기동시2026년10월로시간을이동했고VM은원본2023-09-09~16UTC를유지한다. 날짜축동일·동일버킷비교PASS로주장하지않는다. Rill의Deploy가이링크snapshot과같은동작이라고주장하지않는다.

## 자동 검사와 리뷰

- BE5suites125개 PASS: 신규publication31개 + 기존editor/legacy공유회귀. 실제in-memorySQLite의unique·CAS동시게시·재시도·중지후영수증거절·권한·만료/삭제·공개읽기AI/query호출0·migration멱등/데이터있는down거절을확인했다. 실제집계는위DuckDB/Ego증거다.
- FE3files31개 PASS: 신규게시12개·기존복구helper19개. 미리보기선행·ticket만전송·동일body재시도·409상태확인·400새preview가능·묵은route응답무시·만료링크미노출·전송전UUID오류구분·익명fetchcredentialsomit·숫자+추세렌더를확인했다. MUI테스트환경emStyled오류로UI프리미티브를mock했으며실제디자인은Ego로검증했다.
- FEtype/변경lint/build·BE변경lint/build PASS. 기존Vite경고·레거시CSS경고는별도다.
- 별도리뷰의400복구·만료링크·전송전오류를수정했다. source/CAS/retry/revoke재검토는범위내차단결함없음이었다. 리뷰가발견한TypeORM no-op UPDATE의updatedAt변경을명시보존으로수정하고unit/최종runtime의게시전후수정일동일을확인했다. 리뷰어의독립실행PASS로표시하지않는다.
- AIWFstrictlint는기존UC007~010오류12개가남는다. suppression/baseline을추가하지않았다. UC018새오류는없다.

## 원복·한계

마지막게시중지후분석12제목을원래대로UI미리보기/저장하고조회했다. 제목·SQL·blockId·모든폭논리배치는처음과같다. 기존editor가layoutSizes를생략하고없던suffix를빈문자열로정규화해raw정의/revision까지완전히같지는않다. 이차이를숨기거나원본정의를임의DB쓰기하지않았다. 기존live공유는N,새게시행은version5/activefalse이며두임시URL모두중지됐다. 검증TaskSpace26은finish({keep:[]})완료,이작업관찰키정리. 사용자탭/Aside세션/다른서버는정리하지않았다.

증빙: 저장소밖 `/tmp/vm-publication/`의before12/edited12/restored12·public-v1/v2·XHR/events·summary·대표png/실측·각검사log. 임시파일영구보존은보장하지않는다. 로컬AIWFpacket은awaiting_review/acceptance not_recorded를유지한다.

운영MySQL·실제휴대폰·계정수신자/다른계정실제UI·LLM질문게시·새게시의실제409/응답본문유실주입·장애/경합모든변형·sourceVersion보장·여러인스턴스ticket공유·복제/전체P4/TC005는NOT_RUN/후속이다. 이미받은화면/복사본회수는보장하지않는다.
