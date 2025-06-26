import * as React from 'react';
import { cn } from '@/lib/utils';

// MUI Chip props
interface MuiChipProps {
  label: React.ReactNode;
  size?: 'small' | 'medium';
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  variant?: 'filled' | 'outlined';
  clickable?: boolean;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDelete?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  deleteIcon?: React.ReactNode;
  icon?: React.ReactNode;
  avatar?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

// Convert sx prop to style/className
const sxToStyle = (sx?: Record<string, any>): React.CSSProperties => {
  if (!sx) return {};
  
  const style: React.CSSProperties = {};
  
  if (sx.backgroundColor) style.backgroundColor = sx.backgroundColor;
  if (sx.color) style.color = sx.color;
  if (sx.fontWeight === 'medium') style.fontWeight = 500;
  
  return style;
};

export const Chip = React.forwardRef<HTMLDivElement, MuiChipProps>(
  ({ 
    label, 
    size = 'medium', 
    color = 'default', 
    variant = 'filled',
    clickable,
    onClick,
    onDelete,
    deleteIcon,
    icon,
    avatar,
    sx,
    className,
    ...props 
  }, ref) => {
    const sizeClasses = {
      small: 'text-xs px-2 py-0.5',
      medium: 'text-sm px-3 py-1',
    };

    const colorClasses = {
      default: variant === 'filled' ? 'bg-gray-200 text-gray-800' : 'border-gray-300 text-gray-800',
      primary: variant === 'filled' ? 'bg-primary text-primary-foreground' : 'border-primary text-primary',
      secondary: variant === 'filled' ? 'bg-secondary text-secondary-foreground' : 'border-secondary text-secondary',
      error: variant === 'filled' ? 'bg-red-500 text-white' : 'border-red-500 text-red-500',
      info: variant === 'filled' ? 'bg-blue-500 text-white' : 'border-blue-500 text-blue-500',
      success: variant === 'filled' ? 'bg-green-500 text-white' : 'border-green-500 text-green-500',
      warning: variant === 'filled' ? 'bg-yellow-500 text-white' : 'border-yellow-500 text-yellow-500',
    };

    const variantClasses = variant === 'outlined' ? 'border bg-transparent' : '';
    const clickableClass = (clickable || onClick) ? 'cursor-pointer hover:opacity-80' : '';
    
    const style = sxToStyle(sx);

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium transition-opacity',
          sizeClasses[size],
          colorClasses[color],
          variantClasses,
          clickableClass,
          className
        )}
        style={style}
        onClick={onClick}
        role={clickable || onClick ? 'button' : undefined}
        tabIndex={clickable || onClick ? 0 : undefined}
        {...props}
      >
        {(icon || avatar) && (
          <span className={cn('flex items-center', size === 'small' ? 'mr-1' : 'mr-2')}>
            {icon || avatar}
          </span>
        )}
        <span>{label}</span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            className={cn(
              'ml-1 rounded-full hover:bg-black/10',
              size === 'small' ? 'p-0.5' : 'p-1'
            )}
          >
            {deleteIcon || (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        )}
      </div>
    );
  }
);

Chip.displayName = 'Chip';