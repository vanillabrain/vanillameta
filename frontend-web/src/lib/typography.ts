export const typography = {
  // 헤딩 스타일
  h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
  h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
  h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
  h4: 'scroll-m-20 text-xl font-semibold tracking-tight',

  // 본문 스타일
  p: 'leading-7 [&:not(:first-child)]:mt-6',
  lead: 'text-xl text-muted-foreground',
  large: 'text-lg font-semibold',
  small: 'text-sm font-medium leading-none',
  muted: 'text-sm text-muted-foreground',

  // 리스트 스타일
  ul: 'my-6 ml-6 list-disc [&>li]:mt-2',
  ol: 'my-6 ml-6 list-decimal [&>li]:mt-2',

  // 인용문
  blockquote: 'mt-6 border-l-2 pl-6 italic',

  // 인라인 코드
  inlineCode: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',

  // 테이블
  table: 'w-full',
  th: 'border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right',
  td: 'border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right',
} as const;

// 타이포그래피 프리셋
export const prose = {
  // 기본 prose 스타일
  default: 'prose prose-slate dark:prose-invert max-w-none',
  // 작은 사이즈
  sm: 'prose-sm prose-slate dark:prose-invert max-w-none',
  // 큰 사이즈
  lg: 'prose-lg prose-slate dark:prose-invert max-w-none',
} as const;
