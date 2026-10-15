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
        'list-none gap-2 p-0',
        layout === 'stack'
          ? 'flex flex-col md:grid md:grid-cols-1'
          : 'flex md:grid md:[grid-template-columns:repeat(auto-fit,minmax(0,228px))]',
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
    <li className="flex-1 list-none">
      <Card
        onClick={handleClick}
        className={cn(
          'flex flex-col gap-0 rounded-lg border border-border bg-card p-5 shadow-none ring-0',
          handleClick && 'cursor-pointer hover:bg-[#ebfbff]',
          className,
        )}
      >
        {children}
      </Card>
    </li>
  );
};
