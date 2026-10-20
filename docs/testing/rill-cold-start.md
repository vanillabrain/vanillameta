# Rill와 동일 예제 새로 제작

기준: 기존 통과 케이스를 다시 실행하는 것이 아니라, 새 계정/메타DB와 새 Rill 프로젝트에서 처음부터 같은 파일과 질문으로 작업을 완료하는 사용자 여정 비교다. 구현/검증은 `codex/self-service-next-20261014` 워크트리에서 수행한다. AI_PROVIDER=codex / gpt-6-luna 유지, 다른 모델 fallback 없음. Rill 내부 모델은 동일성 확인 대상 밖이다.

## 명세

| ID | 입력·동작 | 기대 |
| --- | --- | --- |
| COLD-01 | 양쪽 새 소스에 같은 auction_data.parquet 가져오기 | SHA256/1391572행/원본날짜 일치. SQL을 직접 써서 AI 성공을 대체하지 않음 |
| COLD-02 | 같은 생성문으로 전체기간2KPI+1기기별가로막대 요청 | SUM(bid_request_cnt)=634513000, SUM(bid_floor)/NULLIF(SUM(has_bid_floor_cnt),0)=5.5712386765263995±1e-9, 기기9개내림차순. 설명과 실제SQL/지표정의 일치 |
| COLD-03 | 동일제목수정문, 저장/반영→reload | Auction device analysis / Requests by Device. KPI계산식·전체기간·필터없음·USD2자리·K/M 유지. VM 기존대시보드ID 유지 |
| COLD-04 | 새 업로드에서 AI생성→저장, 소스화면에서 AI열기·취소 | 업로드1회, WASM필요없음, 업로드소스선택, 명시생성·저장, 상세URL이동, 취소는 URL의aiSourceId제거 |
| COLD-05 | desktop1440×900/mobile390×844 관찰, 키보드AI/Assistant/보조영역 | document가로overflow없음, KPI·9기기 읽기, AI/Assistant닫기, summary Enter열기/닫기. 스크린리더전체준수로 확대하지 않음 |

생성문: `Create a dashboard named Auction comparison using auction_data. Use all rows and the full time range, with no filters. Create exactly two KPI cards and one horizontal bar chart: Total requests = SUM(bid_request_cnt); Average bid floor = SUM(bid_floor) / NULLIF(SUM(has_bid_floor_cnt), 0), displayed as USD with 2 decimals; Requests by device = SUM(bid_request_cnt) grouped by device_type, sorted largest first. Do not use AVG(bid_floor). Show the exact calculation and data range. Use K/M compact formatting for request counts. Preserve the raw __time dates.`

수정문: `Rename the dashboard to Auction device analysis and rename the device chart to Requests by Device. Keep the two KPI formulas, full time range, no filters, USD two decimals, K/M request formatting, and largest-first horizontal bars unchanged.`

## 2026-10-14 결과

외부 [실행기록](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-cold-start-20261014/RESULTS.md), JSON/PNG/실패후수정이 원본이다. 기준 commit21d87990 + 실행diff.

- COLD-01 PASS: 같은SHA256/1391572행/raw2023-09-09~16.
- COLD-02 VM PASS: 최초실Luna초안, 독립원본SQL와2KPI/9개값일치. Rill 최초FAIL(설명과실제AVG정의/기간불일치)→추가AI질문으로수정→실제SUM비율정의·SQL실행합계·반올림KPI·9개막대관찰PASS_SELECTED_VARIANTS. RillUI의9개원시값전체추출은NOT_RUN.
- COLD-03 PASS: 양쪽제목수정·reload. VM dashboard2 SQL/표현설정불변. Rill파일즉시반영과VM명시적저장차이기록.
- COLD-04 최초UX부족/저장이동오류→수정후PASS. 파일→AI와기존소스→AI, dashboard3저장/상세URL/reload. 권한목록밖source미선택회귀포함.
- COLD-05 PASS_SELECTED_VARIANTS: 두서비스document390px, VM키보드AI/Assistant/summary Enter동작, Rill모바일내부스크롤기기9개. 개인보기·긴설명을접어KPI가시성개선. Rill긴기간/설명잘림잔존, Rill전체키보드NOT_RUN, 실제VoiceOverBLOCKED유지.

관련단위3파일66개/Explore17개PASS, 마지막패널8개PASS, FE타입·lint·build PASS. 심볼릭링크모듈해석 때문에초기WASM mock2개가실패했으나임시preserveSymlinks로24개PASS. 임시설정은제거했다. 변경없는기존통과케이스/전체core/출시회귀반복안함. 새자동UI suite추가없음.

## 다음 보완

필터·도구바를더짧게정리해작업공간/KPI를확보하고, AI제안의변경내역·계산식·기간을같이확인하도록한다. Rill의코드/YAML작업공간전체를이번에복제하지않았다. 매출·환불다중CSV의동일시작비교는별도범위다.

## 최신 코드 선택 재검증 — 2026-10-14

`791ec485` + 작업diff에서 [재검증 보고서](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/develop-v2-reverify-20261014/RESULTS.md)를 추가했다. COLD-02/03 실제Luna새생성·dashboard6저장·Assistant제목수정·reload 및독립정답/SQL/표현불변PASS. COLD-04/05 소스진입/취소/저장URL·390px·선택키보드PASS_SELECTED_VARIANTS. Rill은관련변경없어기존비교증빙재사용. 전체LLM성공률/출시/VoiceOver로확대하지않는다. 워크트리CSV브라우저분석WASM로딩오류를정식Vite preserveSymlinks/dedupe설정으로수정해핵심2개재통과·FE693개/타입/lint/build통과. 임시설정없음.
