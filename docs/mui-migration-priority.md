# MUI to Shadcn/ui 마이그레이션 우선순위

## 마이그레이션 전략

101개 이상의 파일에서 MUI를 사용하고 있으므로, 단계적이고 체계적인 접근이 필요합니다.

## 우선순위 그룹

### 🔴 Phase 1: 핵심 기본 컴포넌트 (즉시 시작)

가장 많이 사용되고 기본이 되는 컴포넌트들:

1. **Button** → shadcn/ui Button
   - 사용 빈도: 매우 높음
   - 난이도: 낮음
   - 영향 범위: 전체 프로젝트

2. **TextField** → shadcn/ui Input
   - 사용 빈도: 매우 높음
   - 난이도: 중간 (validation 처리 필요)
   - 영향 범위: 모든 폼 컴포넌트

3. **Select/MenuItem** → shadcn/ui Select
   - 사용 빈도: 높음
   - 난이도: 중간
   - 영향 범위: 폼 및 필터 컴포넌트

4. **Checkbox** → shadcn/ui Checkbox
   - 사용 빈도: 높음
   - 난이도: 낮음
   - 영향 범위: 폼 컴포넌트

5. **Dialog** → shadcn/ui Dialog
   - 사용 빈도: 높음
   - 난이도: 낮음
   - 영향 범위: 모달 및 확인 대화상자

### 🟡 Phase 2: 레이아웃 및 피드백 컴포넌트

기본 컴포넌트 마이그레이션 후:

6. **Card** → shadcn/ui Card
   - 사용 빈도: 높음
   - 난이도: 낮음
   - 영향 범위: 대시보드 및 위젯

7. **Alert/Snackbar** → shadcn/ui Alert + Toast
   - 사용 빈도: 중간
   - 난이도: 중간
   - 영향 범위: 피드백 시스템

8. **Menu** → shadcn/ui DropdownMenu
   - 사용 빈도: 중간
   - 난이도: 중간
   - 영향 범위: 네비게이션

9. **Typography** → Custom Typography component
   - 사용 빈도: 매우 높음
   - 난이도: 낮음 (이미 typography.ts 준비됨)
   - 영향 범위: 전체 텍스트

10. **Radio/RadioGroup** → shadcn/ui RadioGroup
    - 사용 빈도: 중간
    - 난이도: 낮음
    - 영향 범위: 폼 컴포넌트

### 🟢 Phase 3: 복잡한 컴포넌트

기본 구성요소 안정화 후:

11. **DataGrid** → shadcn/ui Table + tanstack-table
    - 사용 빈도: 높음
    - 난이도: 높음
    - 영향 범위: 데이터 표시 페이지

12. **DatePicker** → shadcn/ui Calendar + Popover
    - 사용 빈도: 중간
    - 난이도: 높음
    - 영향 범위: 날짜 입력 폼

13. **Stepper** → Custom Stepper component
    - 사용 빈도: 낮음
    - 난이도: 중간
    - 영향 범위: 단계별 프로세스

14. **Pagination** → shadcn/ui Pagination
    - 사용 빈도: 중간
    - 난이도: 중간
    - 영향 범위: 리스트 페이지

### 🔵 Phase 4: 유틸리티 컴포넌트

마지막 단계:

15. **Box/Container** → div with Tailwind classes
    - 사용 빈도: 매우 높음
    - 난이도: 낮음 (mui-to-tailwind.ts 활용)
    - 영향 범위: 전체 레이아웃

16. **Grid** → CSS Grid/Flexbox with Tailwind
    - 사용 빈도: 높음
    - 난이도: 중간
    - 영향 범위: 레이아웃

17. **Divider** → shadcn/ui Separator
    - 사용 빈도: 낮음
    - 난이도: 낮음
    - 영향 범위: UI 구분

18. **Paper** → div with shadow classes
    - 사용 빈도: 중간
    - 난이도: 낮음
    - 영향 범위: 컨테이너

## 마이그레이션 접근 방법

### 1. 컴포넌트 래퍼 전략
```tsx
// 예: Button 래퍼
export { Button } from '@/components/ui/button';
// 기존 MUI Button props와 호환되도록 래퍼 작성
```

### 2. 점진적 교체
- 새로운 기능은 shadcn/ui 사용
- 기존 컴포넌트는 안정성 확인 후 교체
- 테스트 커버리지 확보 후 교체

### 3. 스타일 변환
- mui-to-tailwind.ts 헬퍼 함수 활용
- sx prop → className 변환
- 테마 변수 → CSS 변수 매핑

## 예상 타임라인

- **Phase 1**: 2-3주 (핵심 컴포넌트)
- **Phase 2**: 2주 (레이아웃/피드백)
- **Phase 3**: 3-4주 (복잡한 컴포넌트)
- **Phase 4**: 1-2주 (유틸리티)

총 예상 기간: 8-12주

## 주의사항

1. **테스트 우선**: 각 컴포넌트 교체 전 테스트 작성
2. **점진적 배포**: 기능별로 나누어 배포
3. **롤백 계획**: 문제 발생 시 빠른 롤백 가능하도록 준비
4. **성능 모니터링**: 마이그레이션 전후 성능 비교
5. **접근성 확인**: ARIA 속성 및 키보드 네비게이션 유지