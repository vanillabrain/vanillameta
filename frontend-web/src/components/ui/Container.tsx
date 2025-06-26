import React from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  component?: React.ElementType;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fixed?: boolean;
  disableGutters?: boolean;
}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    { component: Component = 'div', className, children, maxWidth = 'lg', fixed = false, disableGutters = false, ...props },
    ref,
  ) => {
    const classes = cn(
      // 기본 container 스타일
      'mx-auto w-full',
      // padding (gutters)
      !disableGutters && 'px-4 sm:px-6 lg:px-8',
      // maxWidth 설정
      maxWidth !== false &&
        {
          'max-w-screen-xs': maxWidth === 'xs', // 444px
          'max-w-screen-sm': maxWidth === 'sm', // 640px
          'max-w-screen-md': maxWidth === 'md', // 768px
          'max-w-screen-lg': maxWidth === 'lg', // 1024px
          'max-w-screen-xl': maxWidth === 'xl', // 1280px
        }[maxWidth],
      className,
    );

    return (
      <Component ref={ref} className={classes} {...props}>
        {children}
      </Component>
    );
  },
);

Container.displayName = 'Container';

export default Container;
