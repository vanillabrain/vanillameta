import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CardWrapper = ({ children, selected, onClick, className = '' }) => {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={Boolean(selected)}
      onClick={onClick}
      className={cn(
        'relative flex h-auto w-full flex-col items-center rounded-lg border bg-card p-5 text-left font-normal normal-case whitespace-normal hover:bg-accent/50',
        selected ? 'border-primary bg-accent/60' : 'border-border',
        className,
      )}
    >
      {children}
    </Button>
  );
};

function ImgCardList(props) {
  const { data, selectedType, handleTypeClick, className } = props;

  return (
    <ul className={cn('m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6', className)}>
      {data.map(item => {
        const selected = selectedType && selectedType.id === item.id;
        return (
          <li key={item.id} className="list-none">
            <CardWrapper selected={selected} onClick={() => handleTypeClick(item)} className="p-0">
              <div className="flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-lg p-4">
                <img alt="" src={'/static/images/' + item.icon} className="h-12 w-16 border-0 object-contain" />
                <span className="text-center text-sm leading-5 font-medium">{item.title}</span>
                {item.description ? (
                  <span className="mt-1 text-center text-xs leading-[1.3] text-muted-foreground">{item.description}</span>
                ) : (
                  ' '
                )}
              </div>
            </CardWrapper>
          </li>
        );
      })}
    </ul>
  );
}

export default ImgCardList;
