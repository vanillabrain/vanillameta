# 레이아웃 컴포넌트 마이그레이션 가이드

## 개요

이 문서는 Material-UI의 레이아웃 컴포넌트(Box, Container, Grid)를 새로운 Tailwind 기반 컴포넌트로 마이그레이션하는 방법을 안내합니다.

## 1. Box 컴포넌트 마이그레이션

### 기본 사용법

```tsx
// Before (MUI)
import { Box } from '@mui/material';

<Box sx={{ m: 2, p: 3, display: 'flex', alignItems: 'center' }}>
  Content
</Box>

// After (새로운 컴포넌트)
import { Box } from '@/components/ui';

<Box m={2} p={3} display="flex" alignItems="center">
  Content
</Box>
```

### sx prop 변환

sx prop 대신 개별 prop이나 className을 사용합니다:

```tsx
// Before
<Box sx={{ 
  m: 'auto', 
  fontSize: '18px', 
  fontWeight: 600,
  bgcolor: 'primary.main'
}}>

// After - prop 사용
<Box className="mx-auto text-lg font-semibold">

// After - prop과 className 혼합
<Box m="auto" className="text-lg font-semibold">
```

### 주요 prop 매핑

| MUI sx | 새 컴포넌트 prop | Tailwind class |
|--------|-----------------|----------------|
| `m: 1` | `m={1}` | `m-2` |
| `p: 2` | `p={2}` | `p-4` |
| `display: 'flex'` | `display="flex"` | `flex` |
| `flexDirection: 'column'` | `flexDirection="column"` | `flex-col` |
| `alignItems: 'center'` | `alignItems="center"` | `items-center` |
| `justifyContent: 'space-between'` | `justifyContent="space-between"` | `justify-between` |
| `bgcolor: 'primary.main'` | `bgcolor="primary.main"` | `bg-primary` |
| `borderRadius: 1` | `borderRadius={4}` | `rounded` |

## 2. Container 컴포넌트 마이그레이션

### 기본 사용법

```tsx
// Before (MUI)
import { Container } from '@mui/material';

<Container maxWidth="lg">
  Content
</Container>

// After (새로운 컴포넌트)
import { Container } from '@/components/ui';

<Container maxWidth="lg">
  Content
</Container>
```

### maxWidth 옵션

- `xs`: max-w-screen-xs (444px)
- `sm`: max-w-screen-sm (640px)
- `md`: max-w-screen-md (768px)
- `lg`: max-w-screen-lg (1024px)
- `xl`: max-w-screen-xl (1280px)
- `false`: 제한 없음

### 추가 옵션

```tsx
// gutters 제거
<Container disableGutters>

// fixed 레이아웃 (미구현 - 필요시 className 추가)
<Container fixed className="max-w-[1140px]">
```

## 3. Grid 컴포넌트 마이그레이션

### 기본 사용법

```tsx
// Before (MUI)
import { Grid } from '@mui/material';

<Grid container spacing={3}>
  <Grid item xs={12} sm={6} md={4}>
    Item 1
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    Item 2
  </Grid>
</Grid>

// After (새로운 컴포넌트)
import { Grid } from '@/components/ui';

<Grid container spacing={3}>
  <Grid item xs={12} sm={6} md={4}>
    Item 1
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    Item 2
  </Grid>
</Grid>
```

### 주요 prop

- `container`: Grid 컨테이너로 설정
- `item`: Grid 아이템으로 설정
- `spacing`: 아이템 간 간격 (0-8)
- `xs`, `sm`, `md`, `lg`, `xl`: 반응형 너비 (1-12 또는 'auto')
- `direction`: flex 방향
- `alignItems`, `justifyContent`: flex 정렬

### 복잡한 레이아웃 예시

```tsx
// 중첩된 Grid
<Grid container spacing={2}>
  <Grid item xs={12} md={8}>
    <Grid container spacing={1}>
      <Grid item xs={6}>
        Nested 1
      </Grid>
      <Grid item xs={6}>
        Nested 2
      </Grid>
    </Grid>
  </Grid>
  <Grid item xs={12} md={4}>
    Sidebar
  </Grid>
</Grid>
```

## 4. 마이그레이션 체크리스트

1. **Import 변경**
   ```tsx
   // Before
   import { Box, Container, Grid } from '@mui/material';
   
   // After
   import { Box, Container, Grid } from '@/components/ui';
   ```

2. **sx prop 제거**
   - sx prop의 스타일을 개별 prop이나 className으로 변환
   - 복잡한 스타일은 className으로 처리

3. **테스트**
   - 레이아웃이 동일하게 표시되는지 확인
   - 반응형 동작 테스트
   - spacing과 정렬 확인

4. **점진적 마이그레이션**
   - 한 파일씩 차례대로 변환
   - 각 변환 후 동작 확인
   - 문제 발생 시 원복 가능하도록 커밋

## 5. 주의사항

1. **스타일 우선순위**
   - className의 스타일이 prop 스타일보다 우선될 수 있음
   - 필요시 `!important` 사용 고려

2. **타입 안정성**
   - TypeScript 사용 시 prop 타입 확인
   - 잘못된 prop 값은 무시됨

3. **성능**
   - 불필요한 re-render 방지를 위해 memo 사용 고려
   - 큰 리스트에서는 가상화 적용

## 6. 도움말

추가 지원이 필요한 경우:

1. `mui-to-tailwind.ts` 유틸리티 함수 확인
2. Tailwind CSS 문서 참조
3. 기존 마이그레이션된 파일 참고

## 7. Button 컴포넌트 마이그레이션 (Task 2.3 완료)

### 개요
MUI Button, IconButton, ButtonGroup 컴포넌트가 Shadcn/ui Button으로 마이그레이션되었습니다. 호환성 레이어(`mui-button-compat`)를 통해 점진적 마이그레이션이 가능합니다.

### 기본 사용법

```tsx
// Before (MUI)
import { Button, IconButton } from '@mui/material';

<Button variant="contained" color="primary" size="large">
  Click me
</Button>

// After (호환성 레이어 사용)
import { Button } from '@/components/ui/mui-button-compat';

<Button variant="contained" color="primary" size="large">
  Click me
</Button>
```

### 주요 변경사항

1. **Import 경로 변경**
   ```tsx
   // Before
   import { Button } from '@mui/material';
   
   // After
   import { Button } from '@/components/ui/mui-button-compat';
   ```

2. **Variant 매핑**
   - `text` → `ghost`
   - `contained` → `default`
   - `outlined` → `outline`

3. **Size 매핑**
   - `small` → `sm`
   - `medium` → `default`
   - `large` → `lg`

4. **Color 매핑**
   - `primary` → `default`
   - `secondary` → `secondary`
   - `error`, `warning` → `destructive`
   - `info` → `secondary`
   - `success` → `default`
   - `inherit` → `ghost`

5. **IconButton 변환**
   ```tsx
   // Before
   <IconButton color="primary">
     <DeleteIcon />
   </IconButton>
   
   // After (자동 변환)
   <Button variant="text" size="icon">
     <DeleteIcon />
   </Button>
   ```

6. **LoadingButton 지원**
   ```tsx
   <LoadingButton loading={isLoading} loadingPosition="start">
     Save
   </LoadingButton>
   ```

### 마이그레이션 상태

- ✅ 69개 컴포넌트 마이그레이션 완료
- ✅ IconButton → Button variant="text" 자동 변환
- ✅ ButtonGroup 컴포넌트 구현 (사용되지 않음)
- ✅ LoadingButton 컴포넌트 구현

## 8. 다음 단계

- TextField, Select 컴포넌트 마이그레이션 (Task 2.4)
- Card, Paper 컴포넌트 마이그레이션 (Task 2.5)