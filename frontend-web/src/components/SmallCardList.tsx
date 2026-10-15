import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function SmallCardList(props) {
  const { data, className } = props;
  const [selectedValue, setSelectedValue] = useState('');

  const handleClick = event => {
    setSelectedValue(event.currentTarget.value);
  };

  return (
    <ul className={cn('m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-6', className)}>
      {data.map(item => (
        <li key={item.id} className="list-none">
          <Button
            type="button"
            variant="outline"
            value={item.id}
            onClick={handleClick}
            aria-pressed={selectedValue === item.id}
            className={cn(
              'relative h-auto min-h-[60px] w-full justify-start px-4 py-3 font-normal',
              selectedValue === item.id && 'border-primary ring-2 ring-primary',
            )}
          >
            <span className="truncate text-sm font-medium">{item.name}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default SmallCardList;
