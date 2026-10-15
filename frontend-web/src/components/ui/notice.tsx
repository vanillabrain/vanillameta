import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type Props = React.ComponentProps<typeof Alert> & { severity?: 'error' | 'warning' | 'success' | 'info' };
export function Notice({ severity = 'info', children, className, ...props }: Props) {
  return (
    <Alert
      variant={severity === 'error' ? 'destructive' : 'default'}
      data-severity={severity}
      className={cn(
        'min-w-0 [&_[data-slot=alert-description]]:break-words data-[severity=success]:border-success/30 data-[severity=success]:bg-success/10 data-[severity=success]:text-success-foreground data-[severity=warning]:border-warning/30 data-[severity=warning]:bg-warning/10 data-[severity=warning]:text-warning-foreground',
        className,
      )}
      {...props}
    >
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
