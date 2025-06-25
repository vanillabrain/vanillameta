# VanillaMeta Frontend: Shadcn/Tailwind 변환 가이드

## 📋 현재 상태 분석

### 기술 스택 현황

- **UI 프레임워크**: Material-UI (MUI) v5 + Radix UI 혼용
- **스타일링**: Emotion (@emotion/react, @emotion/styled) + Tailwind CSS
- **빌드 도구**: Vite
- **컴포넌트 라이브러리**:
  - MUI 컴포넌트 (광범위하게 사용 중)
  - Radix UI 컴포넌트 (Shadcn/ui 기반)
  - Styled Components (일부 사용)

### Shadcn/ui 설정 상태

✅ **이미 설정된 항목:**

- `components.json` 설정 완료
- Tailwind CSS 설정 완료 (CSS 변수 기반)
- Shadcn/ui 컴포넌트 다수 설치됨
- `cn()` 유틸리티 함수 구현됨
- Lucide React 아이콘 설치됨

### 설치된 Shadcn/ui 컴포넌트

```
- alert-dialog    - alert         - avatar        - badge
- button         - calendar      - card          - checkbox
- collapsible    - command       - dialog        - dropdown-menu
- input          - label         - popover       - progress
- radio-group    - scroll-area   - select        - separator
- spinner        - switch        - table         - tabs
- textarea       - toggle        - tooltip       - tree
```

## 🎯 변환 목표

1. **MUI 의존성 제거**: 모든 MUI 컴포넌트를 Shadcn/ui 컴포넌트로 교체
2. **스타일링 통합**: Emotion/Styled Components를 Tailwind CSS로 전환
3. **일관된 디자인 시스템**: Shadcn/ui의 디자인 토큰 활용
4. **성능 개선**: 번들 크기 감소 및 런타임 성능 향상

## 📊 변환 범위 분석

### MUI 사용 현황 (102개 파일)

- **주요 사용 컴포넌트**:
  - Layout: Box, Stack, Grid, Container
  - Input: TextField, Select, MenuItem
  - Display: Typography, Card, Paper
  - Navigation: Button, IconButton
  - Feedback: Alert, Snackbar, Dialog
  - Data Display: Table, DataGrid

### 주요 변환 대상 디렉토리

1. `/pages` - 페이지 컴포넌트
2. `/components` - 공통 컴포넌트
3. `/widget` - 위젯 관련 컴포넌트
4. `/layouts` - 레이아웃 컴포넌트

## 🔄 컴포넌트 매핑 가이드

### Layout 컴포넌트

| MUI                       | Shadcn/Tailwind                                             |
| ------------------------- | ----------------------------------------------------------- |
| `<Box>`                   | `<div className="">`                                        |
| `<Stack>`                 | `<div className="flex flex-col gap-4">`                     |
| `<Stack direction="row">` | `<div className="flex flex-row gap-4">`                     |
| `<Grid container>`        | `<div className="grid grid-cols-12 gap-4">`                 |
| `<Grid item xs={12}>`     | `<div className="col-span-12">`                             |
| `<Paper>`                 | `<Card>` 또는 `<div className="bg-card rounded-lg shadow">` |
| `<Container>`             | `<div className="container mx-auto px-4">`                  |

### Input 컴포넌트

| MUI                        | Shadcn/ui                           |
| -------------------------- | ----------------------------------- |
| `<TextField>`              | `<Input>` + `<Label>`               |
| `<Select>` + `<MenuItem>`  | `<Select>` + `<SelectItem>`         |
| `<Checkbox>`               | `<Checkbox>`                        |
| `<Radio>` + `<RadioGroup>` | `<RadioGroup>` + `<RadioGroupItem>` |
| `<Switch>`                 | `<Switch>`                          |

### Display 컴포넌트

| MUI                            | Shadcn/Tailwind                       |
| ------------------------------ | ------------------------------------- |
| `<Typography variant="h1">`    | `<h1 className="text-4xl font-bold">` |
| `<Typography variant="body1">` | `<p className="text-base">`           |
| `<Card>` + `<CardContent>`     | `<Card>` + `<CardContent>`            |
| `<Divider>`                    | `<Separator>`                         |
| `<Chip>`                       | `<Badge>`                             |

### Navigation 컴포넌트

| MUI                | Shadcn/ui                                 |
| ------------------ | ----------------------------------------- |
| `<Button>`         | `<Button>`                                |
| `<IconButton>`     | `<Button variant="ghost" size="icon">`    |
| `<Tabs>` + `<Tab>` | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` |

### Feedback 컴포넌트

| MUI                  | Shadcn/ui                      |
| -------------------- | ------------------------------ |
| `<Alert>`            | `<Alert>`                      |
| `<Dialog>`           | `<Dialog>`                     |
| `<Snackbar>`         | `<Toast>` (별도 설치 필요)     |
| `<CircularProgress>` | `<Spinner>` 또는 Lucide 아이콘 |
| `<LinearProgress>`   | `<Progress>`                   |

### Data Display

| MUI              | Shadcn/ui                             |
| ---------------- | ------------------------------------- |
| `<Table>` 시리즈 | `<Table>` 시리즈                      |
| `<DataGrid>`     | 커스텀 구현 필요 또는 타사 라이브러리 |

## 🚀 변환 전략

### 1단계: 준비 작업

1. **백업 생성**: 현재 코드베이스 백업
2. **테스트 환경 구축**: 변환 진행 상황 확인용
3. **컴포넌트 인벤토리**: 모든 MUI 사용처 목록화

### 2단계: 점진적 변환

1. **Leaf 컴포넌트부터 시작**: 의존성이 적은 컴포넌트부터 변환
2. **페이지별 변환**: 한 페이지씩 완전히 변환
3. **공통 컴포넌트 우선**: 재사용성이 높은 컴포넌트 우선 변환

### 3단계: 스타일 마이그레이션

1. **Emotion 스타일 추출**: styled-components를 Tailwind 클래스로 변환
2. **테마 변수 매핑**: MUI 테마를 Tailwind 설정으로 이전
3. **반응형 디자인 검증**: 브레이크포인트 동작 확인

### 4단계: 최적화

1. **번들 크기 확인**: MUI 제거 후 번들 크기 측정
2. **성능 테스트**: 렌더링 성능 비교
3. **접근성 검증**: WCAG 준수 여부 확인

## 📁 우선 변환 대상 파일

### High Priority (핵심 컴포넌트)

1. `src/components/button/` - 버튼 컴포넌트들
2. `src/components/form/` - 폼 관련 컴포넌트들
3. `src/components/alert/` - 알림 컴포넌트
4. `src/layouts/Header/` - 헤더 레이아웃

### Medium Priority (페이지 컴포넌트)

1. `src/pages/SignUp/` - 회원가입 페이지
2. `src/pages/Dashboard/` - 대시보드 페이지
3. `src/pages/Widget/` - 위젯 관련 페이지

### Low Priority (복잡한 컴포넌트)

1. `src/components/datagrid/` - 데이터그리드
2. `src/widget/` - 차트 위젯들

## 🛠️ 구현 예시

### Before (MUI)

```tsx
import { Box, Button, TextField, Typography } from "@mui/material";

function LoginForm() {
  return (
    <Box sx={{ p: 3, maxWidth: 400 }}>
      <Typography variant="h4" gutterBottom>
        로그인
      </Typography>
      <TextField fullWidth label="이메일" margin="normal" />
      <TextField fullWidth label="비밀번호" type="password" margin="normal" />
      <Button fullWidth variant="contained" sx={{ mt: 2 }}>
        로그인
      </Button>
    </Box>
  );
}
```

### After (Shadcn/Tailwind)

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  return (
    <div className="p-6 max-w-[400px]">
      <h4 className="text-2xl font-semibold mb-4">로그인</h4>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" />
        </div>
        <Button className="w-full">로그인</Button>
      </div>
    </div>
  );
}
```

## 📝 체크리스트

### 변환 전

- [ ] 현재 코드베이스 백업
- [ ] 테스트 커버리지 확인
- [ ] MUI 사용처 전체 목록 작성
- [ ] 팀원들과 변환 계획 공유

### 변환 중

- [ ] 컴포넌트별 변환 진행 상황 추적
- [ ] 스타일 일관성 유지
- [ ] 접근성 기능 보존
- [ ] 반응형 디자인 검증

### 변환 후

- [ ] MUI 의존성 완전 제거
- [ ] 번들 크기 비교
- [ ] 성능 벤치마크
- [ ] 전체 회귀 테스트

## 🚨 주의사항

1. **DataGrid 마이그레이션**: MUI DataGrid는 복잡한 기능을 제공하므로 대체 솔루션 검토 필요
2. **테마 시스템**: MUI의 테마 시스템에 의존하는 코드 주의
3. **애니메이션**: MUI의 Transition 컴포넌트 대체 방안 필요
4. **아이콘**: Material Icons를 Lucide React로 교체
5. **타입 정의**: TypeScript 타입 업데이트 필요

## 📚 참고 자료

- [Shadcn/ui 공식 문서](https://ui.shadcn.com/)
- [Tailwind CSS 문서](https://tailwindcss.com/)
- [Radix UI 문서](https://www.radix-ui.com/)
- [MUI to Tailwind 마이그레이션 가이드](https://tailwindcss.com/docs/guides/material-ui)

## 🔄 진행 상황

### 완료된 작업

- ✅ Shadcn/ui 초기 설정
- ✅ Tailwind CSS 설정
- ✅ 기본 컴포넌트 설치

### 진행 중

- 🔄 MUI 사용처 분석
- 🔄 변환 계획 수립

### 예정된 작업

- ⏳ 컴포넌트 변환 시작
- ⏳ 스타일 마이그레이션
- ⏳ 테스트 및 검증
