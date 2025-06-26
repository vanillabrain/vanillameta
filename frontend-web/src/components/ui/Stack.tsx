import React from 'react';
import { cn } from '@/lib/utils';
import Box from './Box';

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  component?: React.ElementType;
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  spacing?: number | string | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  divider?: React.ReactNode;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  // MUI 호환 props
  sx?: any;
  // 추가 Box props
  p?: number | string;
  px?: number | string;
  py?: number | string;
  m?: number | string;
  mx?: number | string;
  my?: number | string;
}

/**
 * MUI Stack을 Tailwind로 변환한 컴포넌트
 * 자식 요소들 사이에 일정한 간격을 두는 레이아웃 컴포넌트
 */
const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      component = 'div',
      direction = 'column',
      spacing = 0,
      divider,
      alignItems,
      justifyContent,
      flexWrap = 'nowrap',
      children,
      className,
      sx,
      ...props
    },
    ref,
  ) => {
    // spacing 값 처리
    const getSpacing = (breakpoint?: string) => {
      if (typeof spacing === 'object') {
        return spacing[breakpoint || 'xs'] || 0;
      }
      return spacing;
    };

    // direction에 따른 gap 클래스 생성
    const gapClass = React.useMemo(() => {
      const baseSpacing = getSpacing();
      if (baseSpacing === 0) return '';

      // string인 경우 그대로 사용 (px 단위 등)
      if (typeof baseSpacing === 'string') {
        return ''; // 인라인 스타일로 처리
      }

      // MUI spacing (1 = 8px) to Tailwind gap (1 = 0.25rem = 4px)
      const tailwindValue = baseSpacing * 2;

      if (direction === 'row' || direction === 'row-reverse') {
        return `gap-x-${tailwindValue}`;
      }
      return `gap-y-${tailwindValue}`;
    }, [direction, spacing]);

    // 반응형 spacing 처리
    const responsiveGapClasses = React.useMemo(() => {
      if (typeof spacing !== 'object') return '';

      const classes: string[] = [];
      const breakpoints = ['sm', 'md', 'lg', 'xl'] as const;

      breakpoints.forEach(bp => {
        const value = spacing[bp];
        if (value !== undefined && typeof value === 'number') {
          const tailwindValue = value * 2;
          if (direction === 'row' || direction === 'row-reverse') {
            classes.push(`${bp}:gap-x-${tailwindValue}`);
          } else {
            classes.push(`${bp}:gap-y-${tailwindValue}`);
          }
        }
      });

      return classes.join(' ');
    }, [direction, spacing]);

    // divider가 있는 경우 자식 요소들 사이에 삽입
    const childrenWithDivider = React.useMemo(() => {
      if (!divider) return children;

      const childArray = React.Children.toArray(children);
      const result: React.ReactNode[] = [];

      childArray.forEach((child, index) => {
        result.push(child);
        if (index < childArray.length - 1) {
          result.push(<React.Fragment key={`divider-${index}`}>{divider}</React.Fragment>);
        }
      });

      return result;
    }, [children, divider]);

    return (
      <Box
        ref={ref}
        component={component}
        display="flex"
        flexDirection={direction}
        alignItems={alignItems}
        justifyContent={justifyContent}
        flexWrap={flexWrap}
        className={cn(gapClass, responsiveGapClasses, className)}
        sx={sx}
        {...props}
      >
        {childrenWithDivider}
      </Box>
    );
  },
);

Stack.displayName = 'Stack';

export default Stack;
