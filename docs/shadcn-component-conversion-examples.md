# Shadcn/ui 컴포넌트 변환 예시 모음

## 📋 목차

1. [Layout 컴포넌트](#layout-컴포넌트)
2. [Form 컴포넌트](#form-컴포넌트)
3. [Navigation 컴포넌트](#navigation-컴포넌트)
4. [Feedback 컴포넌트](#feedback-컴포넌트)
5. [Data Display 컴포넌트](#data-display-컴포넌트)

---

## Layout 컴포넌트

### Box → div with Tailwind

#### MUI (Before)

```tsx
<Box
  sx={{
    p: 2,
    m: 1,
    bgcolor: "background.paper",
    borderRadius: 2,
    boxShadow: 1,
  }}
>
  콘텐츠
</Box>
```

#### Tailwind (After)

```tsx
<div className="p-4 m-2 bg-card rounded-lg shadow">콘텐츠</div>
```

### Stack → Flexbox

#### MUI (Before)

```tsx
// Vertical Stack
<Stack spacing={2} alignItems="center">
  <Typography>Item 1</Typography>
  <Typography>Item 2</Typography>
</Stack>

// Horizontal Stack
<Stack direction="row" spacing={3} justifyContent="space-between">
  <Button>버튼 1</Button>
  <Button>버튼 2</Button>
</Stack>
```

#### Tailwind (After)

```tsx
// Vertical Stack
<div className="flex flex-col gap-4 items-center">
  <p>Item 1</p>
  <p>Item 2</p>
</div>

// Horizontal Stack
<div className="flex flex-row gap-6 justify-between">
  <Button>버튼 1</Button>
  <Button>버튼 2</Button>
</div>
```

### Grid → CSS Grid

#### MUI (Before)

```tsx
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    <Paper>왼쪽 콘텐츠</Paper>
  </Grid>
  <Grid item xs={12} md={6}>
    <Paper>오른쪽 콘텐츠</Paper>
  </Grid>
</Grid>
```

#### Tailwind (After)

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Card>
    <CardContent>왼쪽 콘텐츠</CardContent>
  </Card>
  <Card>
    <CardContent>오른쪽 콘텐츠</CardContent>
  </Card>
</div>
```

### Paper → Card

#### MUI (Before)

```tsx
<Paper elevation={3} sx={{ p: 2 }}>
  <Typography variant="h6">제목</Typography>
  <Typography>내용</Typography>
</Paper>
```

#### Shadcn/ui (After)

```tsx
<Card>
  <CardHeader>
    <CardTitle>제목</CardTitle>
  </CardHeader>
  <CardContent>
    <p>내용</p>
  </CardContent>
</Card>
```

---

## Form 컴포넌트

### TextField → Input + Label

#### MUI (Before)

```tsx
<TextField
  fullWidth
  label="이메일"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={!!error}
  helperText={error}
  margin="normal"
/>
```

#### Shadcn/ui (After)

```tsx
<div className="space-y-2">
  <Label htmlFor="email">이메일</Label>
  <Input
    id="email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className={error ? "border-destructive" : ""}
  />
  {error && <p className="text-sm text-destructive">{error}</p>}
</div>
```

### Select → Select

#### MUI (Before)

```tsx
<FormControl fullWidth>
  <InputLabel>국가</InputLabel>
  <Select value={country} onChange={handleChange}>
    <MenuItem value="kr">한국</MenuItem>
    <MenuItem value="us">미국</MenuItem>
    <MenuItem value="jp">일본</MenuItem>
  </Select>
</FormControl>
```

#### Shadcn/ui (After)

```tsx
<div className="space-y-2">
  <Label>국가</Label>
  <Select value={country} onValueChange={setCountry}>
    <SelectTrigger>
      <SelectValue placeholder="국가를 선택하세요" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="kr">한국</SelectItem>
      <SelectItem value="us">미국</SelectItem>
      <SelectItem value="jp">일본</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Checkbox → Checkbox

#### MUI (Before)

```tsx
<FormControlLabel
  control={
    <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
  }
  label="약관에 동의합니다"
/>
```

#### Shadcn/ui (After)

```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="terms" checked={agreed} onCheckedChange={setAgreed} />
  <Label
    htmlFor="terms"
    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
  >
    약관에 동의합니다
  </Label>
</div>
```

### RadioGroup → RadioGroup

#### MUI (Before)

```tsx
<FormControl>
  <FormLabel>성별</FormLabel>
  <RadioGroup value={gender} onChange={handleChange}>
    <FormControlLabel value="male" control={<Radio />} label="남성" />
    <FormControlLabel value="female" control={<Radio />} label="여성" />
    <FormControlLabel value="other" control={<Radio />} label="기타" />
  </RadioGroup>
</FormControl>
```

#### Shadcn/ui (After)

```tsx
<div className="space-y-2">
  <Label>성별</Label>
  <RadioGroup value={gender} onValueChange={setGender}>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="male" id="male" />
      <Label htmlFor="male">남성</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="female" id="female" />
      <Label htmlFor="female">여성</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="other" id="other" />
      <Label htmlFor="other">기타</Label>
    </div>
  </RadioGroup>
</div>
```

---

## Navigation 컴포넌트

### Button → Button

#### MUI (Before)

```tsx
// Primary Button
<Button variant="contained" color="primary" onClick={handleClick}>
  저장
</Button>

// Secondary Button
<Button variant="outlined" color="secondary">
  취소
</Button>

// Text Button
<Button variant="text">
  자세히 보기
</Button>

// Icon Button
<IconButton color="primary" onClick={handleEdit}>
  <EditIcon />
</IconButton>
```

#### Shadcn/ui (After)

```tsx
// Primary Button
<Button onClick={handleClick}>
  저장
</Button>

// Secondary Button
<Button variant="outline">
  취소
</Button>

// Text Button
<Button variant="ghost">
  자세히 보기
</Button>

// Icon Button
<Button variant="ghost" size="icon" onClick={handleEdit}>
  <Edit className="h-4 w-4" />
</Button>
```

### Tabs → Tabs

#### MUI (Before)

```tsx
<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
  <Tabs value={value} onChange={handleChange}>
    <Tab label="프로필" />
    <Tab label="설정" />
    <Tab label="알림" />
  </Tabs>
</Box>
<TabPanel value={value} index={0}>
  프로필 내용
</TabPanel>
```

#### Shadcn/ui (After)

```tsx
<Tabs value={value} onValueChange={setValue}>
  <TabsList>
    <TabsTrigger value="profile">프로필</TabsTrigger>
    <TabsTrigger value="settings">설정</TabsTrigger>
    <TabsTrigger value="notifications">알림</TabsTrigger>
  </TabsList>
  <TabsContent value="profile">프로필 내용</TabsContent>
  <TabsContent value="settings">설정 내용</TabsContent>
  <TabsContent value="notifications">알림 내용</TabsContent>
</Tabs>
```

---

## Feedback 컴포넌트

### Alert → Alert

#### MUI (Before)

```tsx
<Alert severity="error" onClose={handleClose}>
  오류가 발생했습니다!
</Alert>

<Alert severity="warning">
  주의사항입니다.
</Alert>

<Alert severity="info">
  정보 메시지입니다.
</Alert>

<Alert severity="success">
  성공적으로 저장되었습니다!
</Alert>
```

#### Shadcn/ui (After)

```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>오류</AlertTitle>
  <AlertDescription>
    오류가 발생했습니다!
  </AlertDescription>
</Alert>

<Alert>
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>주의</AlertTitle>
  <AlertDescription>
    주의사항입니다.
  </AlertDescription>
</Alert>

<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>정보</AlertTitle>
  <AlertDescription>
    정보 메시지입니다.
  </AlertDescription>
</Alert>

<Alert className="border-green-200 bg-green-50">
  <CheckCircle className="h-4 w-4 text-green-600" />
  <AlertTitle className="text-green-800">성공</AlertTitle>
  <AlertDescription className="text-green-700">
    성공적으로 저장되었습니다!
  </AlertDescription>
</Alert>
```

### Dialog → Dialog

#### MUI (Before)

```tsx
<Dialog open={open} onClose={handleClose}>
  <DialogTitle>삭제 확인</DialogTitle>
  <DialogContent>
    <DialogContentText>정말로 이 항목을 삭제하시겠습니까?</DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>취소</Button>
    <Button onClick={handleDelete} color="error">
      삭제
    </Button>
  </DialogActions>
</Dialog>
```

#### Shadcn/ui (After)

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>삭제 확인</DialogTitle>
      <DialogDescription>정말로 이 항목을 삭제하시겠습니까?</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        취소
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        삭제
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Progress → Progress

#### MUI (Before)

```tsx
// Linear Progress
<LinearProgress variant="determinate" value={progress} />

// Circular Progress
<CircularProgress />
<CircularProgress size={24} />
```

#### Shadcn/ui (After)

```tsx
// Linear Progress
<Progress value={progress} className="w-full" />

// Circular Progress (Using Lucide icons)
<Loader2 className="h-8 w-8 animate-spin" />
<Loader2 className="h-6 w-6 animate-spin" />

// Or custom Spinner component
<Spinner />
<Spinner className="h-6 w-6" />
```

---

## Data Display 컴포넌트

### Table → Table

#### MUI (Before)

```tsx
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>이름</TableCell>
        <TableCell align="right">나이</TableCell>
        <TableCell align="right">직업</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id}>
          <TableCell>{row.name}</TableCell>
          <TableCell align="right">{row.age}</TableCell>
          <TableCell align="right">{row.job}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

#### Shadcn/ui (After)

```tsx
<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>이름</TableHead>
        <TableHead className="text-right">나이</TableHead>
        <TableHead className="text-right">직업</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id}>
          <TableCell>{row.name}</TableCell>
          <TableCell className="text-right">{row.age}</TableCell>
          <TableCell className="text-right">{row.job}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Typography → HTML Elements

#### MUI (Before)

```tsx
<Typography variant="h1">대제목</Typography>
<Typography variant="h2">중제목</Typography>
<Typography variant="h3">소제목</Typography>
<Typography variant="body1">본문 텍스트</Typography>
<Typography variant="body2" color="text.secondary">
  보조 텍스트
</Typography>
<Typography variant="caption">캡션</Typography>
```

#### Tailwind (After)

```tsx
<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
  대제목
</h1>
<h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
  중제목
</h2>
<h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
  소제목
</h3>
<p className="leading-7 [&:not(:first-child)]:mt-6">
  본문 텍스트
</p>
<p className="text-sm text-muted-foreground">
  보조 텍스트
</p>
<span className="text-xs text-muted-foreground">캡션</span>
```

### Chip → Badge

#### MUI (Before)

```tsx
<Chip label="신규" color="primary" />
<Chip label="인기" color="secondary" variant="outlined" />
<Chip
  label="삭제"
  onDelete={handleDelete}
  deleteIcon={<CloseIcon />}
/>
```

#### Shadcn/ui (After)

```tsx
<Badge>신규</Badge>
<Badge variant="outline">인기</Badge>
<Badge variant="secondary" className="gap-1">
  삭제
  <button onClick={handleDelete}>
    <X className="h-3 w-3" />
  </button>
</Badge>
```

---

## 🎨 스타일링 패턴

### Spacing (여백)

#### MUI sx prop

```tsx
sx={{
  p: 2,      // padding: 16px
  m: 1,      // margin: 8px
  mt: 3,     // margin-top: 24px
  px: 4,     // padding-left/right: 32px
}}
```

#### Tailwind classes

```tsx
className = "p-4 m-2 mt-6 px-8";
// p-4 = padding: 1rem (16px)
// m-2 = margin: 0.5rem (8px)
// mt-6 = margin-top: 1.5rem (24px)
// px-8 = padding-left/right: 2rem (32px)
```

### Colors (색상)

#### MUI theme colors

```tsx
sx={{
  bgcolor: 'background.paper',
  color: 'text.secondary',
  borderColor: 'divider'
}}
```

#### Tailwind/Shadcn colors

```tsx
className = "bg-card text-muted-foreground border-border";
```

### Responsive Design

#### MUI breakpoints

```tsx
sx={{
  display: { xs: 'none', md: 'block' },
  width: { xs: '100%', md: '50%' }
}}
```

#### Tailwind responsive

```tsx
className = "hidden md:block w-full md:w-1/2";
```

---

## 📌 변환 시 주의사항

1. **이벤트 핸들러**: onChange → onValueChange (일부 Shadcn 컴포넌트)
2. **상태 타입**: boolean → boolean | "indeterminate" (Checkbox)
3. **크기 단위**: MUI spacing (8px 단위) → Tailwind spacing (4px 단위)
4. **아이콘**: Material Icons → Lucide React icons
5. **애니메이션**: MUI transitions → Tailwind transitions + Radix UI animations

## 🔗 유용한 리소스

- [Tailwind CSS 치트시트](https://tailwindcomponents.com/cheatsheet/)
- [Shadcn/ui 컴포넌트 문서](https://ui.shadcn.com/docs/components/)
- [Lucide 아이콘 검색](https://lucide.dev/icons/)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) (VSCode 확장)
