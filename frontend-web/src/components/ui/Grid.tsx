import React from 'react';
import { cn } from '@/lib/utils';
import { muiSpacingToTailwind } from '@/lib/mui-to-tailwind';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  component?: React.ElementType;
  container?: boolean;
  item?: boolean;
  // Grid container props
  spacing?: number;
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  // Grid item props (12-column system)
  xs?: number | 'auto' | boolean;
  sm?: number | 'auto' | boolean;
  md?: number | 'auto' | boolean;
  lg?: number | 'auto' | boolean;
  xl?: number | 'auto' | boolean;
  // Spacing overrides for items
  spacing2?: number;
  zeroMinWidth?: boolean;
}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      component: Component = 'div',
      className,
      children,
      container = false,
      item = false,
      // Container props
      spacing = 0,
      direction = 'row',
      alignItems,
      justifyContent,
      wrap = 'wrap',
      // Item props
      xs,
      sm,
      md,
      lg,
      xl,
      spacing2,
      zeroMinWidth = false,
      ...props
    },
    ref
  ) => {
    // 그리드 컬럼 값을 Tailwind 클래스로 변환
    const getGridColClass = (value: number | 'auto' | boolean | undefined, breakpoint: string = '') => {
      if (value === undefined) return '';
      if (value === 'auto') return `${breakpoint}${breakpoint ? ':' : ''}col-auto`;
      if (value === true) return `${breakpoint}${breakpoint ? ':' : ''}grow`;
      if (typeof value === 'number' && value >= 1 && value <= 12) {
        // Tailwind의 12 column grid system 사용
        const widthMap: Record<number, string> = {
          1: 'w-1/12',
          2: 'w-2/12',
          3: 'w-3/12',
          4: 'w-4/12',
          5: 'w-5/12',
          6: 'w-6/12',
          7: 'w-7/12',
          8: 'w-8/12',
          9: 'w-9/12',
          10: 'w-10/12',
          11: 'w-11/12',
          12: 'w-full',
        };
        return `${breakpoint}${breakpoint ? ':' : ''}${widthMap[value]}`;
      }
      return '';
    };

    // spacing을 gap으로 변환
    const getGapClass = (spacingValue: number) => {
      // MUI spacing은 8px 기준
      const gapMap: Record<number, string> = {
        0: 'gap-0',
        1: 'gap-2', // 8px
        2: 'gap-4', // 16px
        3: 'gap-6', // 24px
        4: 'gap-8', // 32px
        5: 'gap-10', // 40px
        6: 'gap-12', // 48px
        7: 'gap-14', // 56px
        8: 'gap-16', // 64px
      };
      return gapMap[spacingValue] || 'gap-0';
    };

    const containerClasses = cn(
      container && [
        'flex',
        wrap === 'wrap' && 'flex-wrap',
        wrap === 'nowrap' && 'flex-nowrap', 
        wrap === 'wrap-reverse' && 'flex-wrap-reverse',
        direction === 'row' && 'flex-row',
        direction === 'row-reverse' && 'flex-row-reverse',
        direction === 'column' && 'flex-col',
        direction === 'column-reverse' && 'flex-col-reverse',
        alignItems === 'flex-start' && 'items-start',
        alignItems === 'flex-end' && 'items-end',
        alignItems === 'center' && 'items-center',
        alignItems === 'baseline' && 'items-baseline',
        alignItems === 'stretch' && 'items-stretch',
        justifyContent === 'flex-start' && 'justify-start',
        justifyContent === 'flex-end' && 'justify-end',
        justifyContent === 'center' && 'justify-center',
        justifyContent === 'space-between' && 'justify-between',
        justifyContent === 'space-around' && 'justify-around',
        justifyContent === 'space-evenly' && 'justify-evenly',
        spacing > 0 && getGapClass(spacing),
        // 음수 마진 처리 (MUI Grid의 특징)
        spacing > 0 && `-m-${spacing}`,
      ]
    );

    const itemClasses = cn(
      item && [
        'px-2', // 기본 padding
        spacing2 !== undefined && muiSpacingToTailwind('p', spacing2),
        zeroMinWidth && 'min-w-0',
        // Responsive width classes
        getGridColClass(xs),
        getGridColClass(sm, 'sm'),
        getGridColClass(md, 'md'),
        getGridColClass(lg, 'lg'),
        getGridColClass(xl, 'xl'),
      ]
    );

    const classes = cn(
      containerClasses,
      itemClasses,
      className
    );

    return (
      <Component
        ref={ref}
        className={classes}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Grid.displayName = 'Grid';

export default Grid;