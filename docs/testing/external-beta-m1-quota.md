# M1 나머지 증빙: 쿼터·원장·사용자별 제한·공개 링크 만료

2026-10-24 · 계획: [external-beta-m1-quota.md](../plans/external-beta-m1-quota.md). 코드는 `develop`의 로컬 커밋 `86d4c344` ~ `9da74039`(푸시 전)이다. 이 증빙은 **서비스와 테스트 수준**이다. 쿼터를 실제 LLM 호출에 거는 것은 M2의 게이트웨이이므로 "AI 호출이 막힌다"는 아직 증명하지 않았고, 운영 구성 스택에서 새 엔드포인트를 HTTP로 호출해 보거나 화면을 다시 캡처하지도 않았다.

## 만든 것

| 단위 | 내용 | 주요 파일 |
| --- | --- | --- |
| A | AI 사용량 원장(`ai_usage_ledger`)과 사용자별 쿼터(`user_quota`), `AiQuotaService`(`reserve`·`record`·`summary`·`top`·override), 운영자 CLI `access-cli quota show/set/clear/top` | `backend-api/src/usage/*`, 마이그레이션 `1792700100000-add-ai-usage.ts` |
| B | Studio 공개 링크 기본 30일 만료와 30일 상한(`PUBLICATION_DEFAULT_DAYS`로 기본만 단축), 게시 대화상자 문구·검증 | `dashboard-studio/studio-publication-expiry.ts`, `studio-publication.service.ts`, `StudioPublish.tsx` |
| C | 사용자·라우트별 분당 요청 제한(`@UserThrottle('ai'\|'upload'\|'read')`, 기본 20/5/30), 모델을 부르는 핸들러와 업로드 핸들러에만 적용 | `common/throttle/*`, 11개 컨트롤러 |
| D | 사용자별 업로드 상한: 소스 수(기본 20)와 저장 바이트(기본 5GiB). 사용량은 디스크에서 읽는다(살아 있는 소스의 모든 버전, 정리 대기 중인 삭제 소스의 파일, 사용자의 새로고침 준비 파일). 업로드·파일 교체·새로고침 시작·연결 모델 저장에 적용, 거절은 403 `UPLOAD_QUOTA_EXCEEDED` | `database/upload-limits.ts`, `user-storage.service.ts`, `database.service.ts`, `file-refresh.service.ts`, `bi/source-model.service.ts` |
| E | `GET /me/usage`(본인의 AI·저장 사용량과 한도) | `usage/usage.controller.ts` |

환경변수는 `QUOTA_DAILY_CALLS`·`QUOTA_MONTHLY_TOKENS`·`PUBLICATION_DEFAULT_DAYS`·`USER_THROTTLE_{AI,UPLOAD,READ}_PER_MIN`·`UPLOAD_MAX_{SOURCES,BYTES}_PER_USER`이고, 잘못된 값은 운영 부팅을 거부한다. **기본값은 모두 제품 확정 전의 자리표시자다.**

## 검증

모든 테스트는 `audit` 서브에이전트가 커밋 단위로 격리된 사본에서 실행했다.

- **백엔드 전체**: 최종 커밋 `9da74039`에서 330개 스위트·**5734개 테스트 통과, 실패 0**(13개 스위트·188개는 원래 환경 조건으로 건너뛰는 것이고 MySQL 전용 스펙이 포함된다). 그 직전 실행(`c076d3a1`)에서는 새로 만든 `module-wiring.spec.ts`의 한 글자 이름 정규식 결함 2건이 실패였고 `9da74039`에서 고쳤다.
- **프런트엔드 전체**: 3338개 통과(프런트엔드 파일은 `61cb651a` 이후 바뀌지 않았다). 부하가 걸릴 때 `SourceDetails.test.tsx`가 5초 제한으로 흔들린 적이 있고 이번 변경과 무관하며 단독 실행은 통과한다.
- 빌드·타입 검사·eslint: 백엔드·프런트엔드 모두 통과(eslint 오류 0, 백엔드 경고 6건은 `app.module.ts`·`database.controller.ts`의 미사용 import로 이번 시리즈의 diff에 없는 줄이다).
- **실제 MySQL 8.4**(colima `vm-m0-build`의 일회용 컨테이너, 검증 뒤 삭제): 마이그레이션이 만든 스키마와 엔티티가 만든 스키마가 같은지(컬럼·타입·인덱스), 12건 동시 `reserve`가 일일 한도만큼만 통과하고 거절된 건의 `quota_denied` 행이 남는지(3회 반복), 사용자 행 잠금 앞에 일반 읽기를 두면 한도를 넘는다는 것, 오래된 epoch의 거절. 6/6 통과. 첫 실행에서 `user_quota.updatedAt`의 `ON UPDATE`가 마이그레이션에 빠진 것이 실제로 드러나 `6a46de77`에서 고쳤다.
- **실제 의존성 주입 확인**: `AiModule`·`BiModule`이 선언한 providers를 Nest에 그대로 넣어 `DatabaseService`·`SourceModelService`가 해석되는지 확인했고, `UserStorageService`를 빼면 "Nest can't resolve dependencies…"로 실패했다. 이 확인은 저장소에 넣지 않았고, 저장소에는 모듈 파일을 읽는 `module-wiring.spec.ts`(텍스트 검사)만 있다.
- **변형 확인**(격리 사본에서 코드를 일부러 망가뜨려 해당 테스트가 실패하는지. 파일 교체의 변환 후 크기 검사는 처음에 어떤 테스트도 잡지 못했고 `e5065664`에서 테스트를 추가한 뒤 실패로 잡힘을 확인했다): 예약 잠금 제거, 429를 커밋 앞에서 던지기, `record`의 상태·사용자 조건 제거, 거절 행 집계, 시간대(`TZ=Asia/Seoul`) 경계, 유일 인덱스 제거, 기본 만료·상한 제거, 요청 해시에 기본값 섞기, 사용자 키 제거, 정리 제거, 핸들러 데코레이터 제거·추가, 가드 순서 변경, 업로드·삭제 영수증·새로고침 준비 파일 합산 제거, 임시 파일 정리 제거, 새로고침 시작의 검사 제거, 연결 모델 검사 제거, `/me/usage` 가드 제거·다른 사용자 값 반환, 모듈 구성 제거. 모두 의도한 테스트가 실패했다.

### 검증이 찾아 고친 결함 (출시 전에 막은 것)

- 새 `UserStorageService`를 `AiModule`이 제공하지 않아 **앱이 부팅하지 않음**(TypeScript의 `?`는 Nest가 무시). 빌드와 단위 테스트로는 보이지 않았다.
- 사용자별 제한을 컨트롤러 전체에 붙여, Studio 실행 목록(2초마다 폴링)과 대시보드 필터 변경이 정상 사용에서 429를 받음.
- 거절된 업로드의 임시 파일(최대 512MiB)이 디스크에 남음.
- 기본 바이트 상한(1GiB)이 한 번의 임포트 상한(2GiB)보다 작아 정상 업로드가 거절될 수 있음.
- Studio가 업로드 한도 거절(403)을 "권한 없음" 문장으로 표시함.
- 공개 링크 기본 만료를 요청 본문에 써서, 같은 요청을 다음 날 재시도하면 충돌할 뻔함.
- 연결 모델 저장 검사를 직렬화 트랜잭션 안에 두면 MySQL에서 사용자 소스를 읽는 동안 `database` 테이블 전체에 잠금이 걸림(`ownerId`에 인덱스가 없음).

## 아직 증명하지 않은 것, 알려진 한계

- **쿼터는 어디에도 연결돼 있지 않다.** `AiQuotaService`를 부르는 곳은 M2의 `llm-gateway`이고, 그때 JWT의 `authVersion`(epoch)을 넘겨야 한다. 월간 토큰 검사는 호출이 끝난 뒤의 토큰으로 판단하므로 진행 중인 호출만큼 넘을 수 있다(M2에서 `maxOutputTokens`를 예약 추정치로 쓰는 선택지가 있다).
- 이번 변경은 운영 구성 스택에서 HTTP로 실행하지 않았다(`GET /me/usage`, 429 응답, 업로드 403). 격리 프로브에 `GET /me/usage`를 넣는 것과 화면 재확인은 하지 않았다.
- 사용량 칩(Studio 머리글)은 아직 없다. 호출하는 곳이 없는 지금은 항상 0이라 M2와 함께 낸다.
- **MySQL에 시간이 기록되는 방식**: 앱이 넣는 `createdAt`은 API 프로세스의 지역 시각으로 저장된다(운영 컨테이너는 UTC). `access-cli`는 API와 같은 시간대에서 실행해야 한다.
- 업로드 상한은 일부 경로에서 느슨하다: 파일 교체와 연결 모델 저장의 검사는 사용자 행 잠금 밖이라 동시 요청이 한 건씩 넘을 수 있고(업로드 자체는 잠금 안에서 검사), commerce 가져오기에서 연결하지 않은 원본 묶음은 소유자를 알 수 없어 합산하지 않는다(사용자별 요청 제한으로만 제한).
- 사용자별 제한은 프로세스 메모리에 있어 단일 인스턴스 전제다. 고정 1분 창이라 창 경계에서 최대 2배까지 몰릴 수 있다.
- `database.ownerId`에 인덱스가 없다. 사용량 계산이 사용자 소스를 읽을 때 테이블을 훑는다(베타 규모에서는 문제 없음, 읽기 전용이라 잠금은 없음).
- 이미 만료 없이 게시된 링크는 재게시 전까지 바뀌지 않는다. 재게시하면 30일 만료가 적용된다.
- 기본 한도 숫자(일일 30회, 월 50만 토큰, 업로드 20개, 5GiB, 분당 20/5/30회)는 제품 판단이 필요하다.
