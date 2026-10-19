# VM 시나리오 데모 데이터 / Rill 비교 프로젝트

전체 24개 시나리오의 목표·실행 상태는 [검증 기록](../../docs/testing/rill-scenarios.md)을 따른다. 최신 결과는 MD의 선택 샘플 데모 범위 24/24 PASS이며, Rill 전체 기능 동등성이나 운영 수용 완료를 뜻하지 않는다.

`data/margin.csv`와 `data/funnel.csv`는 VanillaMeta가 만든 고정 합성 데이터다. Rill 공식 데이터나 고객 자료가 아니다. Studio의 비용·마진/앱 전환 샘플과 바이트가 같으며 fixture 테스트가 일치 여부를 확인한다. 실제 공식 샘플은 별도의 [Rill 광고 샘플](../rill/README.md), 매출·환불은 기존 Analytics Engineering 출처를 따른다.

## VanillaMeta 시연

앱의 `/studio/new`에서 샘플 선택 → 질문 입력 → 전체 미리보기 → 명시 비공개 저장을 진행한다. 샘플 선택 자체는 AI나 대시보드 저장·게시를 실행하지 않는다. AI 제공자는 기존 Codex/gpt-6-luna 설정을 유지한다.

- 마진: `매출과 비용, 이익은 USD로 표시하고 총매출·총비용·이익·마진율과 company별 이익을 만들어 줘. 마진율은 profit 합계를 revenue 합계로 나누고 백분율로 표시해 줘.`
- 전환: `방문·다운로드·가입 합계와 다운로드 전환율(downloads/visits), 가입 전환율(signups/downloads)을 백분율로 보여 주고 버전별 다운로드도 비교해 줘.`
- 저장 후 지표 탐색(`/explore/source`)에서 같은 소스 → **집계 조건** → company → 총매출 ≥1000, 마진 <20 → 적용. 모든 조건은 AND다. 기간/원본 필터 후 대상별 집계로 판단하며, 통과한 대상의 원본 행으로 전체 KPI/추세/상세를 다시 계산한다. 조건 변경은 결과를 무효화하고 명시 적용 전 조회하지 않는다. 집계 조건의 개인 보기 저장/복원·component Pivot·표시 CSV와 Studio Pivot 블록 연결을 지원한다. 구체적인 선택 범위는 [집계 조건 후속](../../docs/testing/rill-scenarios.md#rxs02-저장pivot-후속-계약)을 따른다.

## Rill 대조

공식 설치 방식은 [Rill 설치 문서](https://docs.rilldata.com/developers/get-started/install)를 따른다. 검증 버전은 v0.90.5다. Rill Cloud 계정/배포/AI 연결은 필요하지 않다.

```sh
rill start samples/rill-scenarios --port 9019 --port-grpc 49019 --no-open --pull-env=false
```

`margin_explore`의 Preview → **All time**을 선택한다. 편집기에서 미리보기로 넘어가면 기본 최근7일로 바뀔 수 있으므로 실제 기간을 확인한다. Add filter → Revenue → By dimension: Company → Greater Than Or Equals:1000, Margin Percent → Company → Less Than:0.2를 적용한다. Rill은 이 비율을0~1 값으로 저장하고 percentage로 표시하며, VM은 scale100/% 지표로 저장하므로 VM 입력20과 Rill 입력0.2가 같은 조건이다. Export model data → CSV에서 선택된8행을 대조할 수 있다.

| 범위 | 매출 USD | 비용 USD | 이익 USD | 마진 |
|---|---:|---:|---:|---:|
| 전체18행/6회사 |14937.49|12279.94|2657.55|17.7911416175…%|
| Hanul Foods+Baro Tech /8행 |5431.25|5138.46|292.79|5.3908400460…%|

금액은 CSV에서 DOUBLE로 추론되며 센트 단위 정답은 Decimal로 독립 합산한다. 마진은 회사별 비율의 단순 평균이 아니다. 매출0/음수 이익 행을 포함하며, `profit`은 합성 원본 열이다. 이것은 저장 지표 조합(RXS03) 구현을 대신하지 않는다. 전환16행은 단계별 집계의 일부 조합으로, 사용자별 순서/중복 제거·코호트 퍼널 엔진이 아니다. 전환 정답은 방문8560/다운로드1854/가입555, 다운로드21.6588785…%·가입29.935275…%다.

## 저장 지표 조합 / AI 비용률

VM 마진 데모를 저장하면 총매출·총비용을 저장 지표로 재사용할 수 있다. 지표 탐색의 **계산 지표 만들기**에서 `(A−B)` 또는 `(A−B)/C ×100`을 선택하고 A=총매출/B=총비용/C=총매출로 미리보기→명시 저장한다. 전체 이익2657.55 USD/마진17.7911416175…%가 정답이다. 원본 profit 열을 쓰지 않고 저장 지표의 ID·정의 버전을 서버에서 고정한다. 같은 계산을 Explore/Pivot/CSV에서 합계 기준으로 재계산하며 분모0은NULL이다. FORMULA를 또 다른 저장 FORMULA의 피연산자로 쓰거나 다른 소스로 재매핑하는 것은 현재 명시 거절한다.

`/studio/new`에서 같은 소스→총매출·총비용 선택→다음 질문도 시연할 수 있다.

> 저장된 총비용과 총매출 두 지표를 조합해 비용률(총비용÷총매출×100)을 새 계산 지표로 만들어 줘. FORMULA 저장 지표 참조로만 계산하고 원본 열 RATIO_SUM이나 기존 마진으로 대체하지 마. 비용률 숫자와 day별 추세·company별 막대 차트3개를 소수점 둘째 자리 백분율로 보여 줘.

명시 저장 후 Studio에서 계산 근거를 펼치면 참조한 이름·ID·버전이 표시된다. 비용률은82.208858382499…%=82.21%다. 미리보기 중 지표/대시보드 쓰기는 없으며3블록을 저장해도 동일 계산 지표는1개다. Rill `calculated_profit`/`calculated_margin`/`cost_ratio`도 동일 원시 합계 식이며 percentage 내부값은0~1이다. VM/Rill이 같은 저장 지표 정의 API를 사용하는 것은 아니고 같은 데이터·계산 결과/표시를 비교한다.

## 비용 기여 원본 탐색

같은 소스에서 총비용 숫자·날짜 추세·component/location 막대를 요청→비공개 저장→**기존 보기**로 이동한다. 총비용의 시간 표에서2025-01-16을 Enter로 선택→Query→Incheon→기여 원본을 연다. 총비용1715 USD/원본1행(Cheonji Retail, Query, Incheon, Q-100, analytics)이 정답이다. Escape로 닫으면 조건과 초점이 유지된다. 지역·서비스 필터를 해제하고 선택 기간을 되돌리면 전체12279.94로 복귀한다. raw timestamp line의 기여 원본은 아직 안전 증명 미지원이며 이 시연은 지원되는 KPI 시간 선택을 사용한다.

## 환불률 분모와 없는 금액

매출·환불 샘플에서 `환불률 숫자와 ordered_at별 추세를 보여 줘`라고 요청하면 계산 전에 분모를 선택한다. 결제 완료 주문 수를 선택하면8/35×100=22.857142857…%, 성공 결제액이면4457.60/20994.61×100=21.232116243…%다. 분모를 추측하거나 각 주문의 환불 비율을 평균하지 않는다. 각 생성안은 확인 후 명시 비공개 저장한다.

Rill의 `commerce_explore`도 동일37주문 코호트를 사용한다. 원본은 `backend-api/src/commerce/samples/`의 Analytics Engineering 공개 합성 자료(CC BY 4.0)이며 원본 SHA256·각 합계/35·8을 확인하는 `python3 samples/rill-scenarios/prepare-commerce.py`로 `data/commerce.csv`를 다시 만든다. 결제/환불을 각각 주문별 합산 후 연결해1:N 중복을 막는다. 두 비율의 KPI를 All time에서 비교한다. 이 코호트는 주문일 기준이고 현금 유입/환불 이벤트일 분석과 다르다.

앱 전환 샘플에는 금액/단가가 없다. `다운로드 수나 전환율 대신 총 매출 금액(USD)을 보여 줘. 금액·단가가 없으면 필요한 자료를 질문해 줘`를 요청하면 없는 자료를 안내해야 한다. 전환율로 바꾼 미리보기나 저장 버튼이 나오면 실패다. 금액 소스를 새로 준비하고 선택하거나 요청을 수정해 이어간다. 모든 임의 질문의 의미를 항상 판정한다는 보장은 아니다.


## 버전 추세·보고서 데모

앱 전환 소스의 지표 탐색에서 `값별 추세 비교`를 열고 version의 v1.9/v2.0, 다운로드/다운로드율을 명시 선택한다. 전체840/1014와20%/23.2568807339…%,1월18일 상세/Pivot854/23.92156862745…%를 대조한다. country=KR은540/565와20%/22.6%다. 조건 편집은 이전 결과를 무효화하며 실행은 명시적이다. 카탈로그 재조회는 기본 탐색으로 초기화한다. UTC외·비교 보기 저장/CSV는 현재 별도다.

비용·마진 소스의 Studio에서 다음 질문으로 시작한다:

> 비용·마진 보고서 4블록: 저장 총매출을 숫자 KPI, 저장 총비용을 day별 선 차트, 저장 이익을 company별 집계 표(presentation=table), 저장 이익을 집계 요약(presentation=summary)으로 만들어 줘. 기존 저장 지표만 참조해. 금액 USD 소수 둘째 자리. 전체 기간, 미리보기만.

저장 전 표/요약의 실제 표현과 숫자를 확인한다. 14937.49 매출,12279.94 비용,2657.55 이익이 기준이다. 블록 설정의 `블록 표현`에서 차트↔표 또는 숫자↔집계 요약을 전환할 수 있으며 계산/필터는 유지된다. 요약은 실제 집계 한 값을 읽는 제한된 문장이고 작성 설명은 별도로 표시된다. 다중 지표 열 표·자유형 AI 분석 보고서/클레임별 인용은 후속 범위다.

Rill에서는 같은 CSV/metrics의 `dashboards/margin_report.yaml` Canvas를 연다. KPI/비용 추세/company 이익 표와 정적 설명이 같은 공유 범위를 사용한다. 설명은 작성 문맥이며 동적으로 생성한 숫자로 간주하지 않는다. 공식 [Canvas 문서](https://docs.rilldata.com/reference/project-files/canvas-dashboards)와 [표 컴포넌트](https://docs.rilldata.com/developers/build/dashboards/canvas-widgets/data)를 기준으로 구성했다. VM의 동적 집계 요약과 Rill의 markdown을 동일 기능으로 해석하지 않는다. 클라우드 배포/AI/유료 서비스는 사용하지 않는다.

## 보고서의 같은 조건으로 탐색

저장한 보고서에서 표 블록의 `계산 근거`를 열고 같은 조건 탐색 링크를 연다. 미저장 변경이 있으면 저장부터 한다. VM은 저장 revision·파일 버전·지표 정의 digest를 확인한 읽기 화면에서 원본 지표·차원·기간·필터를 보여 준다. `현재 조건으로 탐색 계속`은 현재 지표 카탈로그를 사용하는 일반 Explore로 이어진다. 고객 Cheonji Retail은 이익1763.65 USD,2025-01-16 하루는735 USD다. 낡은 링크는409로 차단하며 다른 기본 숫자를 보여 주지 않는다. Rill Canvas의 표 카드 `Go to VM margin comparison`은 같은 범위의 Flat Pivot으로 직접 이동한다. VM의 확인 단계와 Rill의 직접 Pivot은 UX 차이로 구분한다.


## 샘플을 내 파일로 바꾸기

비용·마진 또는 보고서 저장본의 Studio에서 `저장본 복제`를 연다. `샘플 파일로 복제 연습`의 정상 USD/이익 열 누락/KRW 오류 파일은 서로 다른 비공개 소스만 준비한다. `data/margin-reuse.csv`를 `/data/file`의 파일 선택창으로 직접 올려 사용할 수도 있다. `revenue → sales_amount`, `cost → expense_amount`, `profit → net_profit`을 연결하고 day/company는 유지한다. 누락 파일에서는 이익 블록을 임의 제외하지 말고 정상 파일로 바꿔 전체 미리보기를 만든다.

일반 업로드 파일의 USD 단위는 사용자가 명시 확인한다. KRW 파일은 같은 숫자 타입이어도 USD 보고서에 연결할 수 없다. 전체 미리보기 후 비공개 복사본 저장/reload를 확인한다. 원본/게시본은 유지되며 새 지표·새 블록·모든 폭 배치를 가진다. 저장된 비용률 FORMULA를 복제하면 새 파일의 비용·매출을 참조하는 새leaf와계산지표가 함께 만들어진다. 정답은매출29874.98/비용36839.82/이익-6964.84 USD·비용률123.313287573749…%다. Rill의 `margin_reuse_explore`도같은CSV를사용한다. 로컬검증완료데모는보고서12와내파일계산보고서11이며10은모바일배치실패를발견한역사적복사본이다. 다른환경의ID는설치후달라진다.


## 같은 형식의 새 파일로 갱신

내 파일source의 `/explore?sourceId=…` → `파일 교체 및 버전`에서 `margin-refresh.csv`를 선택하고 검증 후 교체한다. `margin-reuse.csv`와 같은 여섯 열이며 신규1행이 추가된19행 전체 스냅샷이다. 최신 비용률은121.91%다. 단순 추가 적재가 아니며 기존19행 전체 파일을 다시 추가해38행으로 만들지 않는다. 기존source/지표/대시보드ID는유지된다. 갱신전게시snapshot은123.31%를유지하며재게시해야바뀐다. Rill `margin_refresh_explore`도같은19행을사용한다. 저장시각과파일안의업무날짜범위를따로읽는다. 지속작업중단/receipt복구는아직이흐름의기능이아니다.


### 지속 갱신·재시작 데모(RXS16)

`data/margin-refresh-recovery.csv`는 기존19행에2025-01-21 매출100/비용80/이익20 USD를 더한20행이다. 기존 파일 버전 영역에서 파일 선택→검증 후 파일 교체→같은 갱신 요청 확인으로 실행한다. 새로고침은 자동 업로드/재실행하지 않으며 중단 작업은 같은 입력으로 명시 재시도한다. 운영 서버를 중단하지 말고 별도 샘플 API에서만 재시작을 검증한다.

큰 CSV는 커밋하지 않는다. 아래 명령은 기존 파일을 덮어쓰지 않고20행×50,000회=100만행(60,300,060 bytes)을 만들고 독립 Decimal 정답을 출력한다.

```sh
python3 samples/rill-scenarios/prepare-refresh.py --output /tmp/vm-margin-million.csv --repeats 50000
```

같은 생성 CSV를 Rill local_file 소스로 연결하고 `margin_refresh_metrics.yaml`의 model만 새 소스로 바꿔 비교한다. 매출1,548,749,000.00/비용1,885,991,000.00/이익-337,242,000.00 USD·비용률121.775123…%=121.78%다. 반복 합성 데이터이며 실제 고객의 다양한100만행 부하를 뜻하지 않는다. 실행·원자성·표시·제약은 [검증 기록](../../docs/testing/rill-scenarios.md#rxs16-지속-갱신실제-서버-재시작--ego25-후속)을 따른다.


### 열 변경 영향·새 데이터 복구(RXS17)

`data/margin-schema-renamed.csv`는20행의 `expense_amount`를`actual_cost`로 바꾸고 비용을 행별 절반/센트 반올림한 정상 새 파일이다. `margin-schema-type-error.csv`는 원래 비용 열을문자열로 바꾼 오류 전용 파일이다. 기존 파일 교체에서는 둘 다 거절되고 마지막 성공본을 유지한다. 오류 화면의 영향 조회로 저장 지표·블록 참조 열을 확인한다.

정상 renamed 파일을 **새 소스로 업로드**한 뒤, 영향 목록의 `새 데이터로 복사·열 연결`에서 비용 열을직접 연결하고 같은USD단위 확인→모든블록 미리보기→비공개 복사본 저장으로 진행한다. 자동 형변환이나 블록 제외를 사용하지 않는다. 독립 정답은매출30,974.98/비용18,859.92/이익12,115.06 USD·비용률60.887593…%=60.89%다. Rill의`margin_schema_explore`도같은CSV를 사용한다. 원본과 고정 게시본은 보존한다.


### 지연 환불과 정정 배치(RXS18)

`orders-correction-base.csv`를 내 파일로 연결하고 성공 결제액600/환불20/순매출580 USD·금액 환불률3.33%와 `ordered_at` 추세/채널 차트를 만든다. 생성 시 통화를 확인하면 모든 행이USD이며 revenue가 성공 결제액임을 답한다. 수정 시점`updated_at`을 업무일로 쓰지 않는다.

소스의 파일 갱신에서 `지연·정정 데이터 반영 설정`→정정 체크→업무 키`order_id`/수정 시점`updated_at`을 명시한다. `orders-correction-batch.csv` 반영 후4행/매출1000·환불90·순매출910 USD/환불률9%가 정답이다. 신규1/수정1/동일1/오래된 수정 무시1/입력 중복1/배치 내 이전 수정 제외1을 확인한다. `orders-correction-reordered.csv`는 같은 배치의 역순이며 새 파일 버전 없이 성공해야 한다. `orders-correction-conflict.csv`는 기존 수정 시점 충돌을 더 최신 행 뒤에 숨긴 오류 전용 배치로, 전체 거절하고 마지막 성공을 유지해야 한다. 최종 독립 정답은`orders-correction-expected.csv`이며 Rill의 base/final Explore가 같은CSV를 읽는다. 이 고급 설정은 전체 행의 단일 키 정정만 지원하고 삭제/부분 patch/복합 키는 지원하지 않는다.

### 큰 대표 실행과 취소(RXS19 선택 검증 완료)

동일 생성기의`--repeats 200000`은400만행/약241MB를 만든다. 작은20행의 Decimal 정답×반복 횟수로 전체 집계를 확인하며 원본 샘플 표의 첫5행을 전체 결과로 해석하지 않는다. 반복 합성 부하는 실제 고객 데이터의 분포/카디널리티를 대표하지 않는다. 취소 데모는 버전 여유가 있는 전용 소스에서 실행 중`활성화 취소`→같은 요청 GET 확인으로 진행하고, 성공 파일/버전·대시보드를 유지해야 한다. 이미 완료된 작업을 취소 성공으로 기록하지 않는다.400만행을 매 개발 시 자동 실행하지 않는다.


## Git 경로·공급자 사전 연결(RXS07/08)

Git: `git-files.csv`를 fact로, `git-commits.csv`를 사전으로 업로드한다. SQL 없는 제작 화면의 **자료 연결 · 키와 품질 확인**에서 양쪽 commit_id·author→commit_author·경로 file_path를 선택한다. 미리보기→미매칭1행 유지 동의→비공개 연결 소스 저장→AI로 대시보드 만들기다. 활동 커밋 COUNT_DISTINCT(commit_id)4/전체 경로6/파일명4/추가62줄 및 path_directory·commit_author별 추가 줄 차트를 요청한다. 변경 이벤트7과 등록 사전 커밋5를 활동 커밋4로 혼동하지 않는다. 독립 저장본은 원본을 자동 갱신하지 않는다.

공급자: `spending-facts.csv`와 `providers-duplicate.csv`로 provider_id 연결을 시도하면 중복 사전 키1로 저장하지 못해야 한다. `providers.csv`로 바꾸고 provider_name/region→provider_region을 추가한다. total_unique_beneficiaries를 **비가산**으로 선택하고 미매칭2행 유지에 동의해 저장한다. AI에 `total_paid 합계 USD 숫자·claim_count 합계 숫자, 기록 시점 month별/공급자 provider_name별/지역 provider_region별 지급액 차트 5블록. 미매칭 NULL 유지, 고유 인원 합산 금지`를 요청한다. 전체800USD/14건/8행, 공급자350/220/130/NULL100이 정답이다. month 열은 실제 여러 일자이므로 월 버킷이라고 부르지 않는다. 고유 수혜자를 합산해 달라는 별도 요청은 원본 식별자 안내로 끝나야 하며80명을 만들지 않는다.

Rill `git_changes_explore`/`provider_spending_explore` All time에서 동일 CSV를 비교한다. Git Added lines 지표로 leaderboard를 바꾸면 Alice41/Bob17/NULL4·디렉터리28/15/12/4/3이다. 지출은 Paid amount800/Claims14·같은 NULL100이다. VM 연결의 품질 차단·영수증·비가산 정책을 Rill이 같은 방식으로 구현했다고 주장하지 않는다. 모든 자료는 VM 합성 데이터이며 실고객 의료 자료가 아니다. 실제 보존된 검증 ID는 source15/19·dashboard15/16이지만 다른 설치에서는 달라진다.


## 열 변경을 AI와 진단하고 복구(RXS12)

실패한 열 교체의 **영향받는 지표·블록 확인**→**AI와 오류 원인 확인**에서 새 정상 소스를 선택한다. `기존 actual_cost와 새 expense_amount가 같은 원가이며 USD 단위가 같음을 확인했습니다. 명시 연결하고 day/company/sales_amount는 유지해 주세요`처럼 의미를 확인한다. 서버에서 확인한 실패 파일의 삭제/추가/타입 변경과 AI 연결안을 구분한다. 미해결 열이 있으면 자료/의미를 보완하고 재질문한다.

제안이 있어도 원본은 고치지 않는다. 기존 복사·열 연결 링크에서 정상 소스→제안된 열 직접 선택/단위 확인→전체 미리보기→명시 비공개 저장/reload한다. 실제 검증의 source11→8/분석13→17은60.89%→123.31%이며 원본/게시/모든 블록과 배치는 유지한다. 자동 SQL 수정/임의 블록 삭제로 오류를 감추지 않는다. 다른 설치에서는 ID가 달라진다.

## 24개 시나리오 시연 순서

RXS01~24의 **MD에 정의한 선택 데모 범위**를 연결했다. 각 ID의 정확한 입력·정답·실행 증빙과 제외 변형은 [전체 검증 기록](../../docs/testing/rill-scenarios.md)을 따른다. Rill Cloud/SSO/외부 발송 기능을 로컬 데모 성공으로 대체하지 않는다.

| 시연 | 시나리오 | 현재 로컬 진입점 | 핵심 확인 |
|---|---|---|---|
| 비용·마진 / 앱 전환 | RXS01~06 | [마진 Studio3](http://localhost:3460/dashboard/3/studio), [앱 전환4](http://localhost:3460/dashboard/4/studio), [탐색 source4](http://localhost:3460/explore/source?sourceId=4) | 같은 CSV 합계/분모·조건 집계·비교 추세/기여 행 |
| Git / 공급자 자료 연결 | RXS07~08 | [Git15](http://localhost:3460/dashboard/15/studio), [지급16](http://localhost:3460/dashboard/16/studio) | 활동4/추가62줄, 지급800USD/14건, 중복/미매칭/비가산 |
| 보고서 / 복제·내 파일 | RXS09~11 | [보고서9](http://localhost:3460/dashboard/9/studio), [복사 보고서12](http://localhost:3460/dashboard/12/studio) | 보고→같은 조건 탐색·전체 미리보기·새 ID/원본 보존 |
| 오류 대화 / 환불 정의 | RXS12~14 | [복구본17](http://localhost:3460/dashboard/17/studio), [환불8](http://localhost:3460/dashboard/8/studio), `/studio/new`의 앱 샘플 | 실제 열 변경 근거/AI 연결안, 주문 환불률22.86%, 없는 매출은 필요한 열 질문 |
| 갱신·정정·취소 | RXS15~19 | [버전 source9](http://localhost:3460/explore?sourceId=9), [정정14](http://localhost:3460/dashboard/14/studio) | 작은 파일/400만행·지속 영수증·고정 게시본·1000/90/910USD·실행 중 취소 |
| 조직 정책·보고·포털 | RXS20~24 | [관리자](http://localhost:3460/organizations), [현재 파트너 보기](http://127.0.0.1:3460/organizations/1/dashboard/21), [포털](http://127.0.0.1:3460/organizations/1/embed/21) | A4260/B1171.25, 숨긴 열·AI 정책·만료, 본인 수신 예약과 authenticated iframe |

현재 검증 환경은 localhost에 원 소유자,127.0.0.1에 파트너 B를 로그인해 함께 볼 수 있게 열었다. 두 origin을 task API CORS에만 명시했고 사용자/그룹은 URL로 전달하지 않는다. 계정·ID·포트·파일은 이 격리된 로컬 실행의 값이므로 다른 설치에서는 소유 분석 목록에서 선택한다. 자격증명을 저장소에 넣지 않는다. 기존 통과 케이스를 열 때 자동으로 모델/대용량 작업/게시를 반복하지 않는다.

### 조직별 보기 준비(RXS21~23)

원본 분석을 비공개 복제하고 Studio의 **조직 접근** 또는 목록 **조직 분석**을 연다. 조직/그룹→이미 등록된 구성원의 로그인 ID→숫자·차트/허용 열→필수 행 키/값→AI·집계 CSV 정책→일반 공개 링크 차단 동의→정책 저장이다. 이 데모는 company=Hanul Foods/Baro Tech로 행 범위를 고정하고 day/component/revenue만 허용한다. 원가·이익·회사 열은 상세/후보/AI/CSV에 제공하지 않는다. 같은 대시보드의 기존 공개·공유 링크는 차단하며, 그룹 회수 후에도 자동 재개하지 않는다. 다른 독립 대시보드의 전역 보안 분류나 일반 조직 편집/SSO는 구현 범위가 아니다.

### 본인 수신 예약 보고(RXS20)

파트너 조직 보기의 **내 조건 보고·알림**에서 숫자 지표/정확한 10진 임계값/주기를 선택해 명시 저장한다. B의1171.25에 초과1000은 알림, 초과2000은 미달이다. 같은 발생 시점은1건이고 서버 재시작 후에도 DB의 다음 시점으로 재개한다. 그룹/소스/정의/정책 변경 시 과거 숫자를 숨기며 새 예약으로 명시 확인한다. 알림은 본인만 앱 안에서 받는다. 검증용 예약은 현재 모두 중지했으므로 열기만 해서는 새 배경 집계가 반복되지 않는다. 외부 메일/Slack·정시 전달·운영 분산 exactly-once는 별도다.

### 인증된 포털(RXS24)

조직 보기의 **포털 안에서 보기**를 연다. 테마 버튼은 Enter/Space, 후보·필터 적용은 Enter로 동작한다. B의 component=Compute는640.50USD, A의 동일 필터는3460USD다. iframe도 서버 JWT/행·열/AI/CSV 정책을 새로 검사하며 토큰/역할을 주소로 받지 않는다. 테마·필터/경로·계정 변경은 프레임을 새로 시작하고 같은 JWT의 정책 변경도 질문을 지운다. 이 포털은 신뢰된 **같은 origin 앱** 전용이며 임의 외부 사이트용 signed embed/SSO 교환·postMessage API는 제공하지 않는다. Vite dev/preview와 nginx 조직 문서에 `frame-ancestors 'self'`를 설정했다. 배포 환경의 실제 헤더/프록시 검증은 운영 gate로 남긴다.

### 집계 조건의 표시 CSV(RXS02 후속)

[지표 탐색 source4](http://localhost:3460/explore/source?sourceId=4)→집계 조건에서 company/총매출·마진을 선택하고 총매출≥1000·마진<20을 적용한다. **표시 집계 CSV**를 열고 CSV 다운로드를 누른다(Enter 지원). 같은2대상8행/5431.25USD·5.3908400460…%와 조건·단위를 받는다. KPI는 전체 대상 재집계, 대상 표는50개/추세200점까지이며 잘림 여부를 함께 기록한다. 원본 행은 포함하지 않는다. 파일/지표/조건이 바뀌면 명시 재적용하며, 집계 조건 저장 보기와 집계 Pivot 열에서 같은 조건을 재사용한다. 일반/고급 Pivot·대시보드로 자동 전달하지 않는다.

### 조건 저장·복원과 집계 Pivot(RXS02 S1~S3)

집계 조건 탭에서 **집계 Pivot 열=component**→조건 적용→**집계 조건 저장 보기**→이름/현재 보기 저장이다. 새로고침 후 저장 보기에서 불러오거나 집계 조건 탭의 저장 보기에서 명시 복원한다. 아직 조회한 결과가 없어도 불러올 수 있고, **집계 조건 적용**으로 현재 파일을 다시 계산한 뒤 새 보기를 저장한다.

현재 소유 source4에 보기1 `RXS02 매출 1000·마진 20 미만 Pivot`(전체5431.25USD/5.39%)과 보기2 `RXS02 기간·Compute 복원`(2025-01-06~15/Compute/주·3460USD/12.77%)이 있다. 교차 셀·행/열 합계·전체 비율은 각각 원본 재집계다. 최대50대상·20열만 표시하며 전체 합계에는 생략 범위도 포함된다. 모바일 표 초점 후 ←/→·Home/End로 가로 이동한다. 저장한 집계 Pivot을 대시보드에 추가하는 흐름은 후속이다.


### 저장한 집계 Pivot을 대시보드에서 보기

[VM 마진 데모3](http://localhost:3460/dashboard/3)의 하단에 저장 보기1/2의 집계 Pivot을 추가했다. 첫 표는 기본5431.25USD/5.39%, 둘째는 저장한 기간·Compute 조건3460USD/12.77%다. **기간·필터 설정 → component → Compute**를 선택하면 첫 표도 Hanul만 다시 판정해3460USD다. Baro까지 선택하면 빈 결과이며, **필터 초기화**는 각 표의 저장 기본값으로 돌아간다. 공통 날짜는 기본 날짜보다 우선한다. 모바일 표는 내부 가로 스크롤·Home/End를 지원한다.

다른 저장 보기는 탐색의 **집계 조건 저장 보기 → 대시보드에 추가**에서 같은 소스의 소유 분석을 선택한다. Pivot 열이 없는 대상 요약은 추가하지 않는다. 저장 조건 사본이므로 원래 개인 보기를 바꿔도 기존 카드를 자동 교체하지 않는다. 지표 정의가 바뀌면 보기를 갱신해 다시 추가해야 한다. 이 개인 Pivot은 일반 소유 조회 화면용이며 Studio 블록/공개 게시본에는 추가하지 않는다. [D1~D3 검증](../../docs/testing/rill-scenarios.md#rxs02-d1d3-결과--2026-10-18-ego28).


대시보드 집계 Pivot의 **표시 집계 CSV → CSV 다운로드**는 현재 공통 필터·기간을 적용한 조건/KPI/표시 대상/추세/Pivot 셀·열 합계를 저장한다. 원본 행은 포함하지 않으며 비율은 원본 기준 재집계 값이다. 현재 조건을 조회하는 동안에는 이전 파일을 받지 못하고, 새 결과 뒤 다시 열린다. [CSV 후속 검증](../../docs/testing/rill-scenarios.md#rxs02-e1e2-결과--2026-10-18-ego29).


대시보드 집계 Pivot의 **조건 다시 탐색**은 현재 공통 필터·기간과 저장 조건을 편집창에 복원한다. 조건 수정 후 **집계 조건 적용**으로 확인하고 **집계 조건 저장 보기 → 새 개인 보기 저장 → 대시보드에 추가**로 다른 사본을 만든다. 원래 Pivot은 바뀌지 않으며 저장 없이 닫은 입력은 버린다. 데모의 `RXS02 Compute 600 재사용`은 Compute/매출≥600/마진<20의 두 고객·6행,4100.50USD/8.78%다. [F1~F3 검증](../../docs/testing/rill-scenarios.md#rxs02-f1f3-결과--2026-10-18-ego30).


집계 Pivot의 **셀 또는 합계 숫자**를 누르면 그 범위의 **기여 원본**을 확인한다. 원래 집계 조건·공통 필터·저장 보기는 바꾸지 않는다. `RXS02 매출1000·마진20미만`의 Baro Tech×Compute를 열면 매출640.50USD/마진-12.79%, 원가만 발생한 두 행을 포함한3행이 나온다. 모바일 표는 안에서 가로 이동하고 Home/End, Escape는 선택 셀로 돌아간다. [G1~G3 검증/Rill 비교](../../docs/testing/rill-scenarios.md#rxs02-g1g3-결과--2026-10-18-ego31).


## 다른 파일·36행 Pivot 비교

[36행 실제 비교 기록](../../docs/testing/rill-pivot36-comparison.md)은 기존 margin18행을 두 번 붙이고 day→event_day, company→customer, component→service, revenue/cost/profit→sales_amount/expense_amount/earnings로 연결한 변형이다. 이번 검증 프로젝트는 localhost9019의 `vm_pivot36_explore`이며 VM 저장본27/source30과 비교했다. 전체29874.98USD/17.79%, customer별매출≥1000·마진<20%의두고객16행10862.50USD/5.39%가 정답이다. Rill에서는0.2를 마진 임계값으로 입력하고 Pivot 행Customer/열Service·Revenue·Margin Percent를 선택한다. 기존 VM 저장본의 조건은 Pivot 블록 범위다. 화면 전체 KPI에도 같은 집계 조건이 자동 적용된다고 설명하지 않는다. 이 변형을 제품 샘플 메뉴에 새로 추가하거나 고객 데이터로 부르지 않는다.
