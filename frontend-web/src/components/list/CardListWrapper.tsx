import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CardListWrapperProps {
  children: React.ReactNode;
  className?: string;
  /** Stacked lists keep a single vertical column; grid keeps the responsive card grid. */
  layout?: 'grid' | 'stack';
}

interface CardWrapperProps {
  children: React.ReactNode;
  className?: string;
  handleClick?: (item) => void;
}

export const CardListWrapper = (props: CardListWrapperProps) => {
  const { children, className = '', layout = 'grid' } = props;
  return (
    <ul
      className={cn(
        'm-0 min-w-0 list-none gap-3 p-0',
        layout === 'stack' ? 'flex flex-col' : 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
        'min-h-5',
        className,
      )}
    >
      {children}
    </ul>
  );
};

export default CardListWrapper;

export const CardWrapper = (props: CardWrapperProps) => {
  const { children, className = '', handleClick } = props;

  return (
    <li className="min-w-0 list-none">
      <Card
        onClick={handleClick}
        className={cn(
          'flex flex-col gap-0 rounded-lg border border-border bg-card p-5 shadow-none ring-0',
          handleClick && 'cursor-pointer transition-colors hover:border-primary/30 hover:bg-accent/40',
          className,
        )}
      >
        {children}
      </Card>
    </li>
  );
};
