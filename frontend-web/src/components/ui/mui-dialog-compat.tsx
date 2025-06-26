import * as React from 'react';
import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle as ShadcnDialogTitle,
  DialogDescription,
} from './dialog';
import { Button } from './mui-button-compat';
import { cn } from '@/lib/utils';

// MUI Dialog props
interface MuiDialogProps {
  open: boolean;
  onClose?: (event: {}, reason?: 'backdropClick' | 'escapeKeyDown') => void;
  children?: React.ReactNode;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  sx?: Record<string, any>;
}

// Dialog compatibility component
export const Dialog = React.forwardRef<HTMLDivElement, MuiDialogProps>(
  ({ open, onClose, children, maxWidth = 'sm', fullWidth, ...props }, ref) => {
    const handleOpenChange = (open: boolean) => {
      if (!open && onClose) {
        onClose({}, 'backdropClick');
      }
    };

    const maxWidthClass = maxWidth ? {
      xs: 'max-w-xs',
      sm: 'max-w-lg',
      md: 'max-w-2xl',
      lg: 'max-w-4xl',
      xl: 'max-w-6xl',
    }[maxWidth] : '';

    return (
      <ShadcnDialog open={open} onOpenChange={handleOpenChange}>
        <ShadcnDialogContent 
          ref={ref}
          className={cn(
            maxWidthClass,
            fullWidth && 'w-full',
            'p-0'
          )}
          showCloseButton={false}
        >
          {children}
        </ShadcnDialogContent>
      </ShadcnDialog>
    );
  }
);

Dialog.displayName = 'Dialog';

// DialogTitle compatibility
interface MuiDialogTitleProps {
  id?: string;
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

export const DialogTitle = React.forwardRef<HTMLHeadingElement, MuiDialogTitleProps>(
  ({ children, sx, className, ...props }, ref) => {
    const marginBottom = sx?.mb ? `mb-${sx.mb * 4}` : '';
    
    return (
      <DialogHeader className={cn('p-6 pb-0', className)}>
        <ShadcnDialogTitle ref={ref} className={cn('text-lg font-semibold', marginBottom)} {...props}>
          {children}
        </ShadcnDialogTitle>
      </DialogHeader>
    );
  }
);

DialogTitle.displayName = 'DialogTitle';

// DialogContent compatibility
interface MuiDialogContentProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

export const DialogContent = React.forwardRef<HTMLDivElement, MuiDialogContentProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('px-6 py-4', className)} {...props}>
        {children}
      </div>
    );
  }
);

DialogContent.displayName = 'DialogContent';

// DialogContentText compatibility
interface MuiDialogContentTextProps {
  id?: string;
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

export const DialogContentText = React.forwardRef<HTMLParagraphElement, MuiDialogContentTextProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props}>
        {children}
      </p>
    );
  }
);

DialogContentText.displayName = 'DialogContentText';

// DialogActions compatibility
interface MuiDialogActionsProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
  disableSpacing?: boolean;
}

export const DialogActions = React.forwardRef<HTMLDivElement, MuiDialogActionsProps>(
  ({ children, className, disableSpacing, ...props }, ref) => {
    return (
      <DialogFooter className={cn('px-6 pb-6 pt-4', !disableSpacing && 'gap-2', className)}>
        {children}
      </DialogFooter>
    );
  }
);

DialogActions.displayName = 'DialogActions';

// ButtonBase compatibility
interface ButtonBaseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const ButtonBase = React.forwardRef<HTMLButtonElement, ButtonBaseProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ButtonBase.displayName = 'ButtonBase';