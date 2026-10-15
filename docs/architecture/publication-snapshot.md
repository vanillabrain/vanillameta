# UC-018 게시 snapshot 설계

Draft, P4/FR011. 관찰된 gap: 기존 share-url은 live 위젯 조회·share token에 의존해 저장/게시 분리가 없다. 이를 바꾸지 않고 별도의 dashboard_publication과 /published/:uuid를 추가한다. 목표 전체/질문 게시/계정 수신자/복제는 이번 범위 밖이다.

## API 계약

모든 성공 API는 기존 `{status:"SUCCESS",data:아래객체}` envelope를 사용한다. FE 공개 route는 `/published/:uuid`, API는 `/publications/:uuid`다. requestId 생성은 HTTPS/localhost secure context에서 지원한다.

owner prefix `/bi/dashboards/:id/publication` (JWT):

- GET: `{dashboardId,revision,version,publication:null|{uuid,version,publishedAt,expiresAt,dashboardRevision,active}}`.
- POST `/preview` `{expectedRevision}`: `{dashboardId,revision,ticket,snapshot}`. snapshot은 `{schemaVersion:1,title,capturedAt,scope:"전체 기간 · 필터 없음 · UTC",widgets,responsiveLayouts}`. 기존 AiDashboardService.analysis(id,actor,true)와 preview({draft,includeTrends:true},actor) 사용. 전후 revision 대조 및 소유권 재검사.
- POST 본문 `{expectedRevision,expectedVersion,ticket,requestId,expiresAt,visibility:"link"}`: owner 상태 반환. expiresAt은 미래 ISO UTC·최대30일. 서버 생성 snapshot만 저장.
- POST `/revoke` `{expectedVersion}`: owner 상태 반환. 중지 version 증가, 이미 중지면 같은 버전 반환.
- public GET `/publications/:uuid`: `{version,publishedAt,expiresAt,visibility:"link",dataMode:"snapshot",snapshot}`. 원본 상세/토큰 API 연결 없음.

## 저장과 동시성

새 entity dashboard_publication: dashboardId unique PK, uuid unique, version 정수, dashboardRevision, snapshot text, publishedAt/expiresAt ISO 문자열, active boolean, requestId/payloadDigest. 신규 migration은 기존 공유/분석 불변이고 down은 데이터 있을 때 거절한다. SQLite 기존 serializedViewWrite와 transaction·revision CAS를 재사용한다. MySQL 동등 CAS는 구현하되 runtime은 NOT_RUN. migration은 app local 목록과 glob discovery를 지원한다.

preview ticket은 process 메모리에 제한 보관한다. payload를 클라이언트가 고쳐 보내도 사용하지 않는다. 마지막 영수증 재시도는 ticket 소멸 뒤에도 소유권/같은 payload를 확인해 반환한다. 중지·재게시 경합으로 과거 영수증을 새 버전으로 재생하지 않는다. 데이터 갱신 후에도 preview 시점의 집계 결과를 게시하며 capturedAt이 그 시점임을 표시한다. sourceVersion 보장/백업·다중 인스턴스 ticket 공유는 후속이다.

## 화면

저장 화면의 `게시 버전` → 별도 간결한 owner 화면. 전체 기간·고정 집계·링크 수신자·만료와 현재 버전/저장 변경을 보여준다. 미리보기 뒤 명시 게시·재게시. 공개 페이지는 같은 숫자+MetricTrend·WidgetViewer와responsiveBlockStyle을 사용하되 원본/AI/기간 필터를 제공하지 않는다. 기존 share/embed UI는 legacy live 범위를 유지한다.

## 종료 조건

관련 단위·실SQLite CAS/migration·type/lint/build, Ego owner preview→게시→익명 조회→저장 제목 수정에도 이전 게시 불변→재게시→reload→중지 확인. 공개 응답 비밀 필드 부재·SQL 실행0과390/768/1440을 대조한다. 기존 허용된 공개 Rill 검증 분석12만 임시 링크로 검증하고 중지한다. 운영/실휴대폰·모든 경합·전체TC005는 미검증으로 남긴다.

## 독립 의미 리뷰 반영

widget whitelist: blockId,title,description,type,valueField,categoryField(차트),prefix,suffix,decimalPlaces,numberNotation,datas,trend,trendUnavailable. datas는 valueField와categoryField만 scalar로 projection한다. trend는 column/grain/timeZone과points[{time,value}]만 포함한다. fields,sql,databaseId,queries,dimensions,temporalColumns,datasetId,widgetId,filePath 및 contribution metadata는 반환하지 않는다. 모든 blockId에 mobile4/tablet8/desktop12의 유효·비겹침 rect를 요구한다.

| 조건                                                   | HTTP | 복구                    |
| ------------------------------------------------------ | ---- | ----------------------- |
| 저장revision/게시version불일치·같은requestId다른digest | 409  | owner상태확인/새preview |
| ticket없음/만료·잘못된만료/형식                        | 400  | 새preview/입력수정      |
| owner/source권한없음                                   | 403  | 권한거절                |
| 중지할게시없음                                         | 404  | 상태확인                |
| 중지expectedVersion불일치                              | 409  | 상태확인                |
| 같은version의이미중지                                  | 200  | version불변             |
| 공개없음/중지/만료/dashboard없음또는delYn=Y            | 404  | 공개결과없음            |

마지막성공requestId+digest 대조는 ticket 검사보다 먼저이며 현재 소유권은 항상 재검사한다. 활성 게시의 재게시 URL은 유지한다. 중지 또는 만료 후 새 게시에는 UUID를 교체해 과거 수신자의 중지 링크를 다시 활성화하지 않는다. UI는 재개시새링크임을설명한다. 삭제 판정은 원본 Dashboard.delYn이며 공개 조회는 metadata를 읽기만 한다.

현재컬럼은공통TEXT다. SQLite snapshot최대1MiB, MySQL TEXT64KiB경계때문에애플리케이션에서UTF8 60KiB이하로추가제한한다. 운영MySQL실행은NOT_RUN이며1MiB지원으로오해하지않는다. 원본행아님은기존preview의compileContribution.supported가참인안전집계만허용해증명한다. unsupported SQL은공개하지않고거절한다.

배치는저장된논리행/열/span을보존한다. 읽기화면은기존DashboardAnalysis와같은minmax(80px,auto)여서숫자+추세가잘리지않게내용에따라행높이가늘어난다. 편집캔버스와pixel동일배치는보장하지않는다.

구현검증은[UC018증거](../testing/publication-snapshot.md)에있다.공통집계증명기를재사용하므로240표시그룹을넘는SQL·미지원집계는게시하지않는다.읽기값의부동소수점은기존NFR002상대허용오차를따르며게시후에는저장한JSON이불변이다.
