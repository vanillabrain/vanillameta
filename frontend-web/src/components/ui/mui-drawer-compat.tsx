import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';
import { cn } from '@/lib/utils';

// MUI Drawer props
interface MuiDrawerProps {
  open: boolean;
  onClose?: (event: {}) => void;
  anchor?: 'left' | 'right' | 'top' | 'bottom';
  children?: React.ReactNode;
  sx?: Record<string, any>;
  PaperProps?: {
    sx?: Record<string, any>;
    className?: string;
  };
  variant?: 'permanent' | 'persistent' | 'temporary';
  className?: string;
}

// Drawer compatibility component
export const Drawer = React.forwardRef<HTMLDivElement, MuiDrawerProps>(
  ({ open, onClose, anchor = 'left', children, variant = 'temporary', PaperProps, className, ...props }, ref) => {
    const handleOpenChange = (open: boolean) => {
      if (!open && onClose) {
        onClose({});
      }
    };

    // Only support temporary variant with Sheet
    if (variant !== 'temporary') {
      // For permanent/persistent, render a div
      return (
        <div
          ref={ref}
          className={cn(
            'fixed inset-y-0',
            anchor === 'left' && 'left-0',
            anchor === 'right' && 'right-0',
            anchor === 'top' && 'top-0 inset-x-0',
            anchor === 'bottom' && 'bottom-0 inset-x-0',
            'bg-background border-r',
            !open && 'hidden',
            className,
            PaperProps?.className
          )}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          ref={ref}
          side={anchor}
          className={cn(
            PaperProps?.className,
            className
          )}
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }
);

Drawer.displayName = 'Drawer';

// SwipeableDrawer compatibility
interface MuiSwipeableDrawerProps extends MuiDrawerProps {
  onOpen?: (event: {}) => void;
  disableBackdropTransition?: boolean;
  disableDiscovery?: boolean;
  disableSwipeToOpen?: boolean;
  hysteresis?: number;
  minFlingVelocity?: number;
  swipeAreaWidth?: number;
}

export const SwipeableDrawer = React.forwardRef<HTMLDivElement, MuiSwipeableDrawerProps>(
  ({ onOpen, ...drawerProps }, ref) => {
    // Sheet doesn't support swipeable features, so we just use regular Drawer
    return <Drawer ref={ref} {...drawerProps} />;
  }
);

SwipeableDrawer.displayName = 'SwipeableDrawer';