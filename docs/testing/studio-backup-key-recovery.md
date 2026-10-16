# STUDIO-MYSQL06 백업 보존·별도 보관·키 복구

2026-10-16, develop-v2 `577cd8f6` + 미커밋 MYSQL03~05. 검증 스킬/변경 범위 기준을 적용한다. MYSQL03~05 정상 복원/손상 거절과 화면 결과를 재사용한다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| MYSQL06-A | 보존 기간·삭제 금지 조건·별도 보관/키 책임을 정의 | PASS_SELECTED |
| MYSQL06-B | 암호화된 실제 로컬 소스 설정은 키 누락/오류 시 복호화 실패, 분석 SQL 실행0 | PASS_SELECTED |
| MYSQL06-C | 원래 테스트 키를 다시 제공하면 복호화·복사 DuckDB 정답 조회 복구 | PASS_SELECTED |
| MYSQL06-D | 메타데이터/파일 무변경·키/설정이 증빙에 노출되지 않음 | PASS_SELECTED |
| MYSQL06-E | 실제 오프사이트 반출·독립 비밀 저장소에서 복구·RPO/RTO 측정 | NOT_RUN |

실제 키를 삭제/회전하거나 운영 계정·외부 저장소를 변경하지 않는다. B/C는 별도 프로세스 환경에서 키를 숨기고 복구하는 로컬 연습이다. 외부 반출/키 보관소가 지정되지 않은 E는 로컬 복사 성공으로 대체하지 않는다. gpt-6-luna/VoiceOver BLOCKED 유지, 모델 호출0.

## MYSQL06-A 운영 절차

[백업 보존·별도 보관·키 복구](../strategy/backup-retention-recovery.md)에 일7/주4/월3 도입안, 변경 전 hold·마지막 정상 세트 삭제 금지, 원격 재다운로드 검증, 별도 keyRef·필요 키 버전 보존, 실패 시 쓰기 재개 금지를 기록했다. 이것은 문서 계약 검토의 PASS이며 실제14개 세트/스케줄러/외부 보관 완료를 의미하지 않는다. RPO24h/RTO60m는 검토 출발점이며 달성 결과가 아니다. 기존 복원 전 검사 명령과 정확한 파일 목록 계약을 그대로 사용한다.

## MYSQL06-B/C 실제 로컬 암호문·복사 파일

MYSQL05의 vm_backup_guard05 소스1에서 실제 `enc:v1:` 설정을 읽었다. 격리 프로세스에서 CONFIG_SECRET_KEY와 ACCESS_SECRET을 모두 지웠을 때 제품 복호화 함수가 실패했고 DuckDB 워커 호출0이었다. 잘못된 임시 키를 지정해도 복호화 실패/워커 호출0이었다. 오류 본문/키/복호화 평문은 로그에 출력하지 않았다. 전체 API나 앱 시작의 실패 계약을 검증한 것은 아니다.

기존 비공개 QA 설정의 원래 키를 같은 프로세스 환경으로 다시 제공한 뒤 실제 제품 복호화 함수로 읽었다. 암호화 설정이 가리킨 UUID/파일명에 해당하는 MYSQL05 복사 파일을 실제 제품 compiled DuckDB worker의 READ_ONLY 경로로 조회했다. **1,391,572행, SUM(bid_request_cnt)=634,513,000**, 정상 워커 호출1을 확인했다. 다른 모델/가짜 조회/수동 데이터 변경은 없었다.

키는 기존 QA 설정에서 다시 제공했으므로 독립 비밀 저장소 유실/복구 검증이 아니다. 실제 키 삭제/회전·DB 암호문 수정·원본 파일 수정은 하지 않았다. 테스트 프로세스 종료 시 임시 환경은 소멸한다.

## MYSQL06-D 불변·선택 회귀

조회 전후 MySQL30개 테이블의 행·열/인덱스 지문 동일, 복사한3개 파일의 SHA-256 동일을 확인했다. AUTO_INCREMENT 다음 값은 지문 대상이 아니다. 증빙에는 비밀/평문 설정·dump 없이 불변 지문과 결과만 기록했다.

기존 crypto 회귀4개는 재사용하고 키 모두 누락/ACCESS_SECRET 호환 복구 회귀2개만 추가해 실행했다:

```sh
cd backend-api
node node_modules/jest/bin/jest.js --runInBand src/utils/crypto.util.spec.ts --testNamePattern='키가 모두 누락|ACCESS_SECRET으로'
```

Node24에서 **2 PASS / 기존4 SKIPPED**. ts-jest의 기존 TypeScript5.9 지원 범위 경고는 남아 있다. 변경 테스트 lint와 diff check도 확인했다. 제품 실행 코드 변경0이므로 BE/FE 전체 테스트·빌드·기존 모바일/키보드를 반복하지 않았다. 새 UI/화면 캡처 NOT_RUN, MYSQL04 캡처는 기존 증빙으로만 재사용한다.

## 증빙·종료

`/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-backup-key-recovery-20261016`:

- `result.json`: 키 누락/오류/복구와 정답, 미실행 운영 조건
- `metadata-before.json`, `metadata-after.json`, `files-unchanged.json`
- 비밀을 포함하지 않는 `verify.cjs`, 선택 회귀/린트 로그

새 서버/컨테이너/브라우저·외부 연결·자동화·삭제는 추가하지 않았다. 기존 API·인증/AI 설정은 유지했다. MYSQL06-E는 **NOT_RUN**: 외부 저장소/독립 비밀 보관소 미지정이며 로컬 복사를 오프사이트 성공으로 보고하지 않는다. 문서/회귀와 이전 미커밋 기록은 미커밋 유지, gpt-6-luna/VoiceOver BLOCKED 유지·모델0이다.
