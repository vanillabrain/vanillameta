# STUDIO-MYSQL05 손상·부분 백업 사전 차단

기준 develop-v2 `577cd8f6`, 2026-10-16. MYSQL03 정상 백업과 MYSQL04 화면 결과는 재사용한다. 검사 명령은 DB에 연결하지 않는다. 검사 성공 때만 복원 명령을 호출하는 운영 절차를 검증한다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| MYSQL05-A | 기존 정상 SQL·업로드3개를 독립 복사, 크기/SHA-256 확인 | PASS_SELECTED |
| MYSQL05-B | SQL 잘림·같은 크기 변조 거절 | PASS_SELECTED |
| MYSQL05-C | 파일 누락·파일 해시 불일치·예상 외 파일 거절 | PASS_SELECTED |
| MYSQL05-D | manifest 누락/형식 오류·경로 이탈·symlink 거절 | PASS_SELECTED |
| MYSQL05-E | 실패 exit code가 복원 실행을 차단, 로컬 MySQL 대상 지문 불변 | PASS_SELECTED |

신뢰할 수 있는 별도 manifest가 전제다. manifest와 내용이 함께 변조된 공격의 진위 판별, 검사 후 파일 교체의 동시 경합 방지, SQL 의미/버전 호환성 검사, 실제 운영 복원·PITR은 범위 밖이다. 검사와 복원 동안 백업은 쓰기 중지된 비공개 디렉터리에 둔다. 원시 mysql 명령을 직접 실행하면 이 절차를 우회할 수 있다.

## 발견한 공백과 최소 보완

MYSQL03의 임시 restore.py는 dump를 곧바로 mysql stdin에 전달했다. 정상 복원 결과는 유지하지만 손상 사전 차단은 없었다. 제품 UI/API 오류로 확대하지 않고, stdlib만 사용하는 `scripts/verify-backup.py`와 선택 회귀9개를 추가했다. DB 연결·자동 복원·새 의존성·상시 실행/CI 훅은 추가하지 않았다.

검사는 metadata.sql과 uploads 전체 파일 목록·크기·SHA-256을 비교한다. JSON 중복 키/잘못된 descriptor·경로 이탈·symlink도 거절한다. manifest는 명시 경로로 받는다. 정상 MYSQL03 디렉터리의 별도 pre-migration.sql은 다른 세트이므로 새 검증 디렉터리에 섞지 않았다. 운영 사용/형식은 [서버 DuckDB 운영 문서](../strategy/server-duckdb-operations.md#복원-전-백업-검사)를 따른다.

## 실제 검증 결과

기존3359 컨테이너에 새 `vm_backup_guard05`만 생성했다. 독립 복사한 정상 SQL78,691bytes와 업로드85,427,551bytes, 총4파일85,506,242bytes가 원 manifest와 일치했고 검사 뒤 준비 복원을 허용했다. 29개 복원 테이블에 빈 `backup_guard_probe` 한 개만 추가했다. 원본 DB·파일은 수정하지 않았다.

복사본에 다음 오류를 하나씩 넣고 매번 복구했다: SQL200bytes 잘림, SQL 첫 byte 변조(동일 크기), DuckDB 누락, Parquet 첫 byte 변조(동일 크기), 예상 외 partial.tmp, manifest 누락, JSON 잘림, `../outside` 경로, 업로드 symlink. **9종 모두 exit1, 후속 복원 시작 marker 없음**이었다. 복원 분기가 시작됐다면 marker 생성과 probe insert 후 실제 dump 전달을 수행하도록 연결한 실제 shell 명령으로 확인했다.

모든 거절 전후 **30테이블·65행 전체 데이터/열/인덱스 지문 동일**:
`2467782e12b88686693e673adaf6c4d6b3ac7cfb3cdce4f70104412068452387`.
마지막 정상 세트 재검사도 통과했다. 이 지문은 AUTO_INCREMENT 다음 값은 제외한다. 원본 정상 세트의 파일 해시도 별도로 다시 비교했다.

선택 회귀: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_verify_backup.py' -v` → **9 PASS**. Python AST 구문 검사/문서 diff check도 수행했다. 앱 코드 영향0이므로 기존 BE/FE 빌드·E2E·모바일/키보드는 반복하지 않았다. 새 화면 캡처는 NOT_RUN이며 [MYSQL04 실제 복구 Studio 캡처](studio-mysql-daemon.md)는 기존 결과로만 재사용한다. 이번 로그/지문을 새 UI 증빙으로 부르지 않는다.

## 증빙·잔여 범위

외부 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-mysql-backup-guard-20261016`.
`result.json`, `target-before.json`, `target-after.json`, 선택 테스트 로그, 원본 파일 해시 확인 결과, 재현 runner/fingerprint helper를 보관한다. dump/config/암호화 키/비밀번호는 포함하지 않는다. 임시 세트는0700 디렉터리, 덤프/manifest는0600이다. 별도 앱/브라우저/컨테이너는 시작하지 않았다. 기존3359 running·이전3360 stopped 상태를 유지했다.

검사 명령/검증 기록은 미커밋이다. gpt-6-luna 설정·VoiceOver BLOCKED 유지, 모델 호출0. 키 유실/오프사이트 백업·보존 정책·RPO/RTO·실제 운영 규모, DDL 실행 중 crash·호스트 전원 장애/PITR·제품 전체 수용은 별도 gate다.

## 커밋 전 검토·원격 통합 — 2026-10-17

누적 MYSQL03~06은 `8bca915d`, 원격 Studio UC036~039 후속7개는 `38732c4a`로 충돌 없이 보존 병합했다. 범위를 한정한 별도 읽기 검토에서 빈 업로드(`files: {}`)도 거절하는 가용성 오류를 찾았다. 신규 회귀로 최초 실패를 확인한 뒤 빈 목록만 허용하도록 최소 수정했다. 비어 있는 SQL dump/누락 파일·해시·경로 검사는 유지한다. 숨겨져 있던 manifest1MiB 한도는 운영 문서에 명시하고 정확한 한도/한도+1byte 회귀를 추가했다. 수정 후 선택 Python 회귀 **11 PASS**다.

최종 통합 검사:

- BE 전체2100개 중2094 PASS, Supertest 포트 조회 null로 HTTP6개 실패 → 해당 두 스펙만 로컬 포트 사용 권한으로 재실행 **6 PASS**. 최초 루트 명령 자체는 exit1이며 전체2100개를 한 번에 성공했다고 보고하지 않는다.
- FE 전체1361개 중1360 PASS, SourceDetails 선택 상한 회귀1개가5초 timeout → 동일 조건 단독 재실행 **1 PASS/173 SKIP**, 코드/timeout 값 변경 없음.
- 루트 BE/FE build·FE type PASS. 변경 crypto 회귀 lint/문서 링크·diff check PASS. 앱 소스에 로컬 제품 변경은 없고, UI/DB 장애 시나리오는 기존 결과를 재사용한다.

로그: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/backup-integration-20261017`의 root-tests.log/http-retry.log/frontend-tests.log/frontend-retry.log/root-build.log/frontend-type.log/backup-tests.log. 환경 제약과 전체 병렬 실행 중 timeout을 제품 오류로 수정하지 않았다. 외부 오프사이트/독립 키 복구·운영/실기기·VoiceOver 조건은 종전 상태를 유지한다.
