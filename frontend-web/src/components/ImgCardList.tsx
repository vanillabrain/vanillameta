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
        'relative flex h-auto w-full flex-col items-center rounded-lg border bg-card p-5 text-left font-normal normal-case whitespace-normal hover:bg-[#ebfbff]',
        selected ? 'border-[#4481c9] bg-[#edf8ff]' : 'border-border',
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
    <ul
      className={cn(
        'm-0 grid list-none justify-center gap-5 p-0 [grid-template-columns:repeat(auto-fit,minmax(0,169px))]',
        className,
      )}
    >
      {data.map(item => {
        const selected = selectedType && selectedType.id === item.id;
        return (
          <li key={item.id} className="list-none">
            <CardWrapper selected={selected} onClick={() => handleTypeClick(item)} className="p-0">
              <div className="flex h-[169px] flex-col items-center justify-center rounded-lg p-4">
                <img alt="" src={'/static/images/' + item.icon} className="mb-3 h-[60px] w-20 border-0 object-contain" />
                <span className="text-center text-sm leading-[1.3] font-bold">{item.title}</span>
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
