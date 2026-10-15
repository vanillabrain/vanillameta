import React from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function TitleBox(props) {
  const { title = '', width = '100%', button, children, className } = props;

  return (
    <div className={cn('h-full', className)} style={{ width }}>
      <div className="flex w-full flex-row items-center justify-between py-2">
        <span className="text-base font-medium">{title}</span>
        {button}
      </div>
      <Separator className="mb-8" />
      {children}
    </div>
  );
}

export default TitleBox;
