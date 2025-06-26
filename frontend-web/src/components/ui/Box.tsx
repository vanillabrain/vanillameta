import React from 'react';
import { cn } from '@/lib/utils';
import { muiSpacingToTailwind, muiColorToTailwind, muiFlexToTailwind } from '@/lib/mui-to-tailwind';

interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  component?: React.ElementType;
  // Spacing props
  m?: number | string;
  mt?: number | string;
  mr?: number | string;
  mb?: number | string;
  ml?: number | string;
  mx?: number | string;
  my?: number | string;
  p?: number | string;
  pt?: number | string;
  pr?: number | string;
  pb?: number | string;
  pl?: number | string;
  px?: number | string;
  py?: number | string;
  // Display props
  display?: 'flex' | 'inline-flex' | 'block' | 'inline-block' | 'none' | 'grid' | 'inline-grid';
  // Flex props
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  flex?: number | string;
  flexGrow?: number;
  flexShrink?: number;
  gap?: number | string;
  // Size props
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  // Position props
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  zIndex?: number;
  // Color props
  bgcolor?: string;
  color?: string;
  // Border props
  border?: number | string;
  borderTop?: number | string;
  borderRight?: number | string;
  borderBottom?: number | string;
  borderLeft?: number | string;
  borderColor?: string;
  borderRadius?: number | string;
  // Other props
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  sx?: any; // For backward compatibility, but will be ignored
}

const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  (
    {
      component: Component = 'div',
      className,
      children,
      // Spacing
      m,
      mt,
      mr,
      mb,
      ml,
      mx,
      my,
      p,
      pt,
      pr,
      pb,
      pl,
      px,
      py,
      // Display
      display,
      // Flex
      flexDirection,
      alignItems,
      justifyContent,
      flexWrap,
      flex,
      flexGrow,
      flexShrink,
      gap,
      // Size
      width,
      height,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      // Position
      position,
      top,
      right,
      bottom,
      left,
      zIndex,
      // Color
      bgcolor,
      color,
      // Border
      border,
      borderTop,
      borderRight,
      borderBottom,
      borderLeft,
      borderColor,
      borderRadius,
      // Other
      overflow,
      textAlign,
      sx, // Ignored
      style,
      ...props
    },
    ref,
  ) => {
    const classes = cn(
      // Display
      display &&
        {
          flex: display === 'flex',
          'inline-flex': display === 'inline-flex',
          block: display === 'block',
          'inline-block': display === 'inline-block',
          hidden: display === 'none',
          grid: display === 'grid',
          'inline-grid': display === 'inline-grid',
        }[display],
      // Spacing
      m !== undefined && muiSpacingToTailwind('m', m),
      mt !== undefined && muiSpacingToTailwind('mt', mt),
      mr !== undefined && muiSpacingToTailwind('mr', mr),
      mb !== undefined && muiSpacingToTailwind('mb', mb),
      ml !== undefined && muiSpacingToTailwind('ml', ml),
      mx !== undefined && muiSpacingToTailwind('mx', mx),
      my !== undefined && muiSpacingToTailwind('my', my),
      p !== undefined && muiSpacingToTailwind('p', p),
      pt !== undefined && muiSpacingToTailwind('pt', pt),
      pr !== undefined && muiSpacingToTailwind('pr', pr),
      pb !== undefined && muiSpacingToTailwind('pb', pb),
      pl !== undefined && muiSpacingToTailwind('pl', pl),
      px !== undefined && muiSpacingToTailwind('px', px),
      py !== undefined && muiSpacingToTailwind('py', py),
      // Flex
      flexDirection && muiFlexToTailwind('flexDirection', flexDirection),
      alignItems && muiFlexToTailwind('alignItems', alignItems),
      justifyContent && muiFlexToTailwind('justifyContent', justifyContent),
      flexWrap && muiFlexToTailwind('flexWrap', flexWrap),
      gap !== undefined && muiSpacingToTailwind('gap', gap),
      // Position
      position &&
        {
          static: position === 'static',
          relative: position === 'relative',
          absolute: position === 'absolute',
          fixed: position === 'fixed',
          sticky: position === 'sticky',
        }[position],
      // Border
      borderRadius !== undefined &&
        {
          'rounded-none': borderRadius === 0,
          'rounded-sm': borderRadius === 2,
          rounded: borderRadius === 4,
          'rounded-md': borderRadius === 6,
          'rounded-lg': borderRadius === 8,
          'rounded-xl': borderRadius === 12,
          'rounded-2xl': borderRadius === 16,
          'rounded-3xl': borderRadius === 24,
          'rounded-full': borderRadius === 9999 || borderRadius === '50%',
        }[borderRadius],
      // Color
      bgcolor && muiColorToTailwind('bg', bgcolor),
      color && muiColorToTailwind('text', color),
      // Border
      border !== undefined &&
        {
          border: border === 1 || border === '1px',
          'border-2': border === 2 || border === '2px',
          'border-4': border === 4 || border === '4px',
          'border-8': border === 8 || border === '8px',
        }[border],
      borderColor && muiColorToTailwind('border', borderColor),
      // Overflow
      overflow &&
        {
          'overflow-visible': overflow === 'visible',
          'overflow-hidden': overflow === 'hidden',
          'overflow-scroll': overflow === 'scroll',
          'overflow-auto': overflow === 'auto',
        }[overflow],
      // Text align
      textAlign &&
        {
          'text-left': textAlign === 'left',
          'text-center': textAlign === 'center',
          'text-right': textAlign === 'right',
          'text-justify': textAlign === 'justify',
        }[textAlign],
      className,
    );

    // 인라인 스타일 처리
    const inlineStyle: React.CSSProperties = {
      ...style,
      // 수치 값들을 스타일로 처리
      ...(width !== undefined && { width: typeof width === 'number' ? `${width}px` : width }),
      ...(height !== undefined && { height: typeof height === 'number' ? `${height}px` : height }),
      ...(minWidth !== undefined && { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth }),
      ...(minHeight !== undefined && { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }),
      ...(maxWidth !== undefined && { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }),
      ...(maxHeight !== undefined && { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }),
      ...(top !== undefined && { top: typeof top === 'number' ? `${top}px` : top }),
      ...(right !== undefined && { right: typeof right === 'number' ? `${right}px` : right }),
      ...(bottom !== undefined && { bottom: typeof bottom === 'number' ? `${bottom}px` : bottom }),
      ...(left !== undefined && { left: typeof left === 'number' ? `${left}px` : left }),
      ...(zIndex !== undefined && { zIndex }),
      ...(flex !== undefined && { flex }),
      ...(flexGrow !== undefined && { flexGrow }),
      ...(flexShrink !== undefined && { flexShrink }),
    };

    return (
      <Component ref={ref} className={classes} style={inlineStyle} {...props}>
        {children}
      </Component>
    );
  },
);

Box.displayName = 'Box';

export default Box;
