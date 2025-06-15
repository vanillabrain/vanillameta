---
task_id: T05_S04
title: 커서 기반 페이지네이션 구현
status: planned
sprint_id: S04
type: feature
assigned_to: unassigned
last_updated: 2025-06-13T11:00:00Z
---

# Task: 커서 기반 페이지네이션 구현 (T05_S04)

## Task Description
기존 offset 기반 페이지네이션을 커서 기반으로 개선하여 대용량 데이터셋에서의 성능을 향상시킨다. 특히 실시간으로 데이터가 추가되는 환경에서 일관된 결과를 보장한다.

## Acceptance Criteria
- [ ] 커서 기반 페이지네이션 공통 모듈 구현
- [ ] 모든 리스트 API에 적용 (dashboards, widgets, datasets 등)
- [ ] 기존 offset 페이지네이션과의 하위 호환성 유지
- [ ] 양방향 페이징 지원 (next, previous)
- [ ] 성능 테스트 결과 50% 이상 개선
- [ ] API 문서 업데이트

## Technical Notes
### API 설계
```
GET /api/dashboards?cursor=eyJpZCI6MTAwfQ&limit=20
Response: {
  data: [...],
  pageInfo: {
    hasNextPage: true,
    hasPreviousPage: true,
    nextCursor: "eyJpZCI6MTIwfQ",
    previousCursor: "eyJpZCI6ODB9"
  }
}
```

### 구현 계획
1. Cursor Pagination DTO
   ```typescript
   export class CursorPaginationDto {
     @IsOptional()
     @IsString()
     cursor?: string;
     
     @IsOptional()
     @IsInt()
     @Min(1)
     @Max(100)
     limit?: number = 20;
   }
   ```

2. 커서 인코딩/디코딩
   ```typescript
   export class CursorService {
     encode(data: any): string {
       return Buffer.from(JSON.stringify(data)).toString('base64');
     }
     
     decode(cursor: string): any {
       return JSON.parse(Buffer.from(cursor, 'base64').toString());
     }
   }
   ```

3. TypeORM 쿼리 빌더 통합
   - WHERE 절에 커서 조건 추가
   - ORDER BY 최적화
   - 인덱스 활용

## Dependencies
- TypeORM 쿼리 빌더
- Base64 인코딩/디코딩

## Risk & Mitigation
- **리스크**: 커서 조작으로 인한 보안 문제
- **완화**: 커서 서명 및 검증 구현
- **리스크**: 정렬 기준 변경 시 커서 무효화
- **완화**: 커서에 정렬 정보 포함