import * as React from 'react';
import { Dialog, DialogContent, DialogOverlay } from './dialog';

// MUI Modal props interface
interface MuiModalProps {
  open: boolean;
  onClose?: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void;
  children?: React.ReactNode;
  BackdropProps?: {
    sx?: Record<string, any>;
  };
  sx?: Record<string, any>;
  disableEscapeKeyDown?: boolean;
  disableAutoFocus?: boolean;
  disableEnforceFocus?: boolean;
  disableRestoreFocus?: boolean;
  keepMounted?: boolean;
}

// Convert sx prop to className
const sxToClassName = (sx?: Record<string, any>): string => {
  if (!sx) return '';
  
  const classes: string[] = [];
  
  if (sx.display === 'flex') classes.push('flex');
  if (sx.justifyContent === 'center') classes.push('justify-center');
  if (sx.alignItems === 'center') classes.push('items-center');
  
  return classes.join(' ');
};

// Modal compatibility component
export const Modal = React.forwardRef<HTMLDivElement, MuiModalProps>(
  ({ open, onClose, children, BackdropProps, sx, disableEscapeKeyDown, ...props }, ref) => {
    const handleOpenChange = (open: boolean) => {
      if (!open && onClose) {
        onClose({}, 'backdropClick');
      }
    };

    const handleEscapeKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscapeKeyDown && onClose) {
        onClose({}, 'escapeKeyDown');
      }
    };

    React.useEffect(() => {
      if (open && !disableEscapeKeyDown) {
        document.addEventListener('keydown', handleEscapeKeyDown);
        return () => document.removeEventListener('keydown', handleEscapeKeyDown);
      }
    }, [open, disableEscapeKeyDown]);

    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          ref={ref}
          className={`max-w-none p-0 border-0 bg-transparent shadow-none ${sxToClassName(sx)}`}
          showCloseButton={false}
        >
          {children}
        </DialogContent>
      </Dialog>
    );
  }
);

Modal.displayName = 'Modal';

// Paper component for Modal content
interface PaperProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
  elevation?: number;
}

export const Paper = React.forwardRef<HTMLDivElement, PaperProps>(
  ({ children, sx, className = '', elevation = 1, ...props }, ref) => {
    const convertSxToClasses = (sx?: Record<string, any>): string => {
      if (!sx) return '';
      
      const classes: string[] = [];
      
      // Layout
      if (sx.display === 'flex') classes.push('flex');
      if (sx.flexDirection === 'column') classes.push('flex-col');
      if (sx.justifyContent === 'center') classes.push('justify-center');
      if (sx.alignItems === 'center') classes.push('items-center');
      
      // Sizing
      if (sx.width) {
        if (typeof sx.width === 'object') {
          if (sx.width.xs === '90%') classes.push('w-[90%]');
          if (sx.width.sm === '80%') classes.push('sm:w-[80%]');
        } else if (sx.width === '100%') {
          classes.push('w-full');
        }
      }
      if (sx.maxWidth) classes.push(`max-w-[${sx.maxWidth}]`);
      if (sx.height === '70%') classes.push('h-[70%]');
      if (sx.maxHeight) classes.push(`max-h-[${sx.maxHeight}]`);
      
      // Spacing
      if (sx.padding) classes.push(`p-[${sx.padding}]`);
      if (sx.pt === 0) classes.push('pt-0');
      
      // Appearance
      if (sx.borderRadius) classes.push(`rounded-[${sx.borderRadius}]`);
      if (sx.backgroundColor === '#fff') classes.push('bg-white');
      if (sx.border) classes.push('border border-gray-300');
      if (sx.boxShadow) classes.push('shadow-lg');
      
      return classes.join(' ');
    };

    const shadowClass = elevation > 0 ? 'shadow-lg' : '';

    return (
      <div
        ref={ref}
        className={`bg-white rounded-lg ${shadowClass} ${convertSxToClasses(sx)} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Paper.displayName = 'Paper';

// Box component compatibility
interface BoxProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
  component?: string;
}

export const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  ({ children, sx, className = '', component = 'div', ...props }, ref) => {
    const Component = component as any;
    const classes = sxToClassName(sx);
    
    return (
      <Component ref={ref} className={`${classes} ${className}`} {...props}>
        {children}
      </Component>
    );
  }
);

Box.displayName = 'Box';

// Stack component compatibility
interface StackProps {
  children?: React.ReactNode;
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  spacing?: number;
  justifyContent?: string;
  alignItems?: string;
  sx?: Record<string, any>;
  className?: string;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ children, direction = 'column', spacing = 0, justifyContent, alignItems, sx, className = '', ...props }, ref) => {
    const directionClass = {
      'row': 'flex-row',
      'row-reverse': 'flex-row-reverse',
      'column': 'flex-col',
      'column-reverse': 'flex-col-reverse',
    }[direction];
    
    const justifyClass = justifyContent ? {
      'flex-start': 'justify-start',
      'flex-end': 'justify-end',
      'center': 'justify-center',
      'space-between': 'justify-between',
      'space-around': 'justify-around',
      'space-evenly': 'justify-evenly',
    }[justifyContent] || '' : '';
    
    const alignClass = alignItems ? {
      'flex-start': 'items-start',
      'flex-end': 'items-end',
      'center': 'items-center',
      'stretch': 'items-stretch',
      'baseline': 'items-baseline',
    }[alignItems] || '' : '';
    
    const spacingClass = spacing > 0 ? `gap-${spacing}` : '';
    const sxClasses = sxToClassName(sx);
    
    return (
      <div
        ref={ref}
        className={`flex ${directionClass} ${justifyClass} ${alignClass} ${spacingClass} ${sxClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';