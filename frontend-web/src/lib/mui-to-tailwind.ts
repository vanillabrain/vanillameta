// MUI to Tailwind CSS 변환 헬퍼 함수들

// MUI spacing (theme.spacing(n) * 8px) to Tailwind spacing
export const muiSpacingToTailwind = (property: string, value: number | string): string => {
  if (typeof value === 'string') {
    // 문자열 값 처리 (예: '100%', 'auto')
    if (value === 'auto') return `${property}-auto`;
    if (value === '100%') return property === 'width' || property === 'w' ? 'w-full' : 'h-full';
    return ''; // 기타 문자열은 인라인 스타일로 처리
  }
  
  // MUI spacing: 1 = 8px, Tailwind: 1 = 0.25rem (4px)
  const tailwindValue = value * 2;
  return `${property}-${tailwindValue}`;
};

// MUI flex properties to Tailwind classes
export const muiFlexToTailwind = (property: string, value: string): string => {
  const flexMap: Record<string, Record<string, string>> = {
    flexDirection: {
      'row': 'flex-row',
      'row-reverse': 'flex-row-reverse',
      'column': 'flex-col',
      'column-reverse': 'flex-col-reverse',
    },
    alignItems: {
      'flex-start': 'items-start',
      'flex-end': 'items-end',
      'center': 'items-center',
      'baseline': 'items-baseline',
      'stretch': 'items-stretch',
    },
    justifyContent: {
      'flex-start': 'justify-start',
      'flex-end': 'justify-end',
      'center': 'justify-center',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    },
    flexWrap: {
      'nowrap': 'flex-nowrap',
      'wrap': 'flex-wrap',
      'wrap-reverse': 'flex-wrap-reverse',
    },
  };

  return flexMap[property]?.[value] || '';
};

// MUI breakpoints to Tailwind responsive prefixes
export const muiBreakpointToTailwind = (breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): string => {
  const breakpointMap = {
    xs: '', // Tailwind default (mobile-first)
    sm: 'sm:', // 640px
    md: 'md:', // 768px
    lg: 'lg:', // 1024px
    xl: 'xl:', // 1280px
  };
  return breakpointMap[breakpoint];
};

// MUI color palette to Tailwind color classes
export const muiColorToTailwind = (prefix: string, color: string, variant?: 'light' | 'main' | 'dark'): string => {
  const colorMap: Record<string, Record<string, string>> = {
    primary: {
      light: 'primary/80',
      main: 'primary',
      dark: 'primary-foreground',
    },
    secondary: {
      light: 'secondary/80',
      main: 'secondary',
      dark: 'secondary-foreground',
    },
    error: {
      light: 'destructive/80',
      main: 'destructive',
      dark: 'destructive-foreground',
    },
    warning: {
      light: 'warning/80',
      main: 'warning',
      dark: 'warning-foreground',
    },
    info: {
      light: 'info/80',
      main: 'info',
      dark: 'info-foreground',
    },
    success: {
      light: 'success/80',
      main: 'success',
      dark: 'success-foreground',
    },
  };

  const colorValue = colorMap[color]?.[variant || 'main'] || color;
  return `${prefix}-${colorValue}`;
};

// MUI typography variants to Tailwind classes
export const muiTypographyToTailwind = (variant: string): string => {
  const typographyMap: Record<string, string> = {
    h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
    h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
    h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
    h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
    h5: 'scroll-m-20 text-lg font-semibold tracking-tight',
    h6: 'scroll-m-20 text-base font-semibold tracking-tight',
    subtitle1: 'text-lg font-medium leading-none',
    subtitle2: 'text-base font-medium leading-none',
    body1: 'text-base leading-7',
    body2: 'text-sm leading-7',
    button: 'text-sm font-medium uppercase tracking-wider',
    caption: 'text-xs text-muted-foreground',
    overline: 'text-xs uppercase tracking-wider text-muted-foreground',
  };

  return typographyMap[variant] || '';
};

// MUI shadows to Tailwind shadow classes
export const muiShadowToTailwind = (elevation: number): string => {
  if (elevation === 0) return 'shadow-none';
  if (elevation <= 1) return 'shadow-sm';
  if (elevation <= 3) return 'shadow';
  if (elevation <= 6) return 'shadow-md';
  if (elevation <= 9) return 'shadow-lg';
  if (elevation <= 12) return 'shadow-xl';
  return 'shadow-2xl';
};

// MUI sx prop style object to Tailwind classes
export const muiSxToTailwind = (sx: Record<string, any>): string => {
  const classes: string[] = [];

  // Padding/Margin
  if (sx.p !== undefined) classes.push(muiSpacingToTailwind('p', sx.p));
  if (sx.px !== undefined) classes.push(muiSpacingToTailwind('px', sx.px));
  if (sx.py !== undefined) classes.push(muiSpacingToTailwind('py', sx.py));
  if (sx.pt !== undefined) classes.push(muiSpacingToTailwind('pt', sx.pt));
  if (sx.pr !== undefined) classes.push(muiSpacingToTailwind('pr', sx.pr));
  if (sx.pb !== undefined) classes.push(muiSpacingToTailwind('pb', sx.pb));
  if (sx.pl !== undefined) classes.push(muiSpacingToTailwind('pl', sx.pl));

  if (sx.m !== undefined) classes.push(muiSpacingToTailwind('m', sx.m));
  if (sx.mx !== undefined) classes.push(muiSpacingToTailwind('mx', sx.mx));
  if (sx.my !== undefined) classes.push(muiSpacingToTailwind('my', sx.my));
  if (sx.mt !== undefined) classes.push(muiSpacingToTailwind('mt', sx.mt));
  if (sx.mr !== undefined) classes.push(muiSpacingToTailwind('mr', sx.mr));
  if (sx.mb !== undefined) classes.push(muiSpacingToTailwind('mb', sx.mb));
  if (sx.ml !== undefined) classes.push(muiSpacingToTailwind('ml', sx.ml));

  // Display
  if (sx.display) {
    const displayMap: Record<string, string> = {
      none: 'hidden',
      block: 'block',
      inline: 'inline',
      'inline-block': 'inline-block',
      flex: 'flex',
      'inline-flex': 'inline-flex',
      grid: 'grid',
    };
    classes.push(displayMap[sx.display] || sx.display);
  }

  // Flexbox
  if (sx.flexDirection) {
    const directionMap: Record<string, string> = {
      row: 'flex-row',
      'row-reverse': 'flex-row-reverse',
      column: 'flex-col',
      'column-reverse': 'flex-col-reverse',
    };
    classes.push(directionMap[sx.flexDirection]);
  }

  if (sx.justifyContent) {
    const justifyMap: Record<string, string> = {
      'flex-start': 'justify-start',
      'flex-end': 'justify-end',
      center: 'justify-center',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    };
    classes.push(justifyMap[sx.justifyContent]);
  }

  if (sx.alignItems) {
    const alignMap: Record<string, string> = {
      'flex-start': 'items-start',
      'flex-end': 'items-end',
      center: 'items-center',
      baseline: 'items-baseline',
      stretch: 'items-stretch',
    };
    classes.push(alignMap[sx.alignItems]);
  }

  // Width/Height
  if (sx.width === '100%') classes.push('w-full');
  if (sx.height === '100%') classes.push('h-full');

  // Background color
  if (sx.bgcolor) {
    classes.push(muiColorToTailwind('bg', sx.bgcolor));
  }

  // Text color
  if (sx.color) {
    classes.push(muiColorToTailwind('text', sx.color));
  }

  // Border radius
  if (sx.borderRadius !== undefined) {
    if (sx.borderRadius === 0) classes.push('rounded-none');
    else if (sx.borderRadius === 1) classes.push('rounded');
    else if (sx.borderRadius === 2) classes.push('rounded-lg');
    else classes.push('rounded-xl');
  }

  return classes.join(' ');
};

// MUI component props to Tailwind classes mapper
export const muiComponentPropsToTailwind = (component: string, props: Record<string, any>): string => {
  const classes: string[] = [];

  switch (component) {
    case 'Button':
      // Size
      if (props.size === 'small') classes.push('h-8 px-3 text-xs');
      else if (props.size === 'large') classes.push('h-11 px-8');
      else classes.push('h-10 px-4 py-2');

      // Variant
      if (props.variant === 'contained') {
        classes.push('bg-primary text-primary-foreground hover:bg-primary/90');
      } else if (props.variant === 'outlined') {
        classes.push('border border-input bg-background hover:bg-accent hover:text-accent-foreground');
      } else if (props.variant === 'text') {
        classes.push('hover:bg-accent hover:text-accent-foreground');
      }

      // Color
      if (props.color && props.color !== 'primary') {
        const color = muiColorToTailwind('', props.color).replace('-', '');
        if (props.variant === 'contained') {
          classes.push(`bg-${color} text-${color}-foreground hover:bg-${color}/90`);
        } else {
          classes.push(`text-${color} hover:bg-${color}/10`);
        }
      }

      // Disabled
      if (props.disabled) {
        classes.push('disabled:pointer-events-none disabled:opacity-50');
      }

      // Full width
      if (props.fullWidth) {
        classes.push('w-full');
      }

      break;

    case 'TextField':
      // Size
      if (props.size === 'small') {
        classes.push('text-sm');
      }

      // Variant
      if (props.variant === 'filled') {
        classes.push('bg-muted');
      } else if (props.variant === 'standard') {
        classes.push('border-b border-0 rounded-none');
      }

      // Full width
      if (props.fullWidth) {
        classes.push('w-full');
      }

      break;

    case 'Paper':
      // Elevation
      if (props.elevation !== undefined) {
        classes.push(muiShadowToTailwind(props.elevation));
      }

      // Square
      if (!props.square) {
        classes.push('rounded-lg');
      }

      break;
  }

  return classes.join(' ');
};

// Helper to migrate MUI makeStyles/styled to Tailwind
export const convertMuiStylesToTailwind = (styles: Record<string, any>): Record<string, string> => {
  const converted: Record<string, string> = {};

  for (const [className, styleObj] of Object.entries(styles)) {
    if (typeof styleObj === 'object') {
      converted[className] = muiSxToTailwind(styleObj);
    }
  }

  return converted;
};