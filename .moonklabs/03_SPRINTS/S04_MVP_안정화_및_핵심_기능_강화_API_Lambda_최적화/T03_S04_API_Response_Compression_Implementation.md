---
task_id: T03_S04
title: API 응답 압축 (gzip) 구현
status: planned
sprint_id: S04
type: performance
assigned_to: unassigned
last_updated: 2025-06-13T11:00:00Z
---

# Task: API 응답 압축 (gzip) 구현 (T03_S04)

## Task Description
API 응답에 gzip 압축을 적용하여 네트워크 전송 데이터 크기를 줄이고 응답 시간을 개선한다. 특히 대용량 JSON 응답에서 큰 효과를 기대할 수 있다.

## Acceptance Criteria
- [ ] NestJS에 compression 미들웨어 설정
- [ ] API Gateway에서 압축 응답 지원 설정
- [ ] 압축 전/후 페이로드 크기 비교 문서화
- [ ] 최소 30% 이상의 페이로드 크기 감소 달성
- [ ] 모든 JSON 응답에 대해 자동 압축 적용
- [ ] 압축 제외 대상 설정 (이미지, 동영상 등)

## Technical Notes
### 구현 계획
1. compression 패키지 설치
   ```bash
   yarn add compression
   yarn add -D @types/compression
   ```

2. main.ts에 미들웨어 추가
   ```typescript
   import * as compression from 'compression';
   
   app.use(compression({
     threshold: 1024, // 1KB 이상만 압축
     level: 6 // 압축 레벨 (1-9)
   }));
   ```

3. API Gateway 설정
   - Binary Media Types에 'application/json' 추가
   - Content-Encoding 헤더 처리 설정

### 측정 지표
- 압축 전/후 응답 크기
- 압축 처리 시간
- 전체 응답 시간 변화

## Dependencies
- compression 패키지
- API Gateway 설정 변경 권한

## Risk & Mitigation
- **리스크**: CPU 사용량 증가로 인한 성능 저하
- **완화**: 압축 레벨 최적화 및 threshold 설정
- **리스크**: 클라이언트 호환성 문제
- **완화**: Accept-Encoding 헤더 확인 로직 추가