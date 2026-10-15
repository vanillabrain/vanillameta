import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const WidgetBox = props => {
  const { children, className, style } = props;

  return (
    <div className={cn('h-[50vw] w-full rounded-lg', className)} style={style}>
      <Card className="h-full gap-0 rounded-lg px-6 py-10 shadow-none ring-0">{children}</Card>
    </div>
  );
};

export default WidgetBox;
