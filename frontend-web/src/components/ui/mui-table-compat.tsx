import * as React from 'react';
import {
  Table as ShadcnTable,
  TableHeader,
  TableBody as ShadcnTableBody,
  TableFooter,
  TableHead as ShadcnTableHead,
  TableRow as ShadcnTableRow,
  TableCell as ShadcnTableCell,
  TableCaption,
} from './table';
import { cn } from '@/lib/utils';

// MUI Table props
interface MuiTableProps {
  children?: React.ReactNode;
  size?: 'small' | 'medium';
  stickyHeader?: boolean;
  sx?: Record<string, any>;
  className?: string;
}

export const Table = React.forwardRef<HTMLTableElement, MuiTableProps>(
  ({ children, size = 'medium', stickyHeader, className, ...props }, ref) => {
    const sizeClass = size === 'small' ? 'text-sm' : '';
    
    return (
      <ShadcnTable
        ref={ref}
        className={cn(sizeClass, stickyHeader && 'sticky-header', className)}
        {...props}
      >
        {children}
      </ShadcnTable>
    );
  }
);

Table.displayName = 'Table';

// TableContainer compatibility
interface MuiTableContainerProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

export const TableContainer = React.forwardRef<HTMLDivElement, MuiTableContainerProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative w-full overflow-auto', className)} {...props}>
        {children}
      </div>
    );
  }
);

TableContainer.displayName = 'TableContainer';

// TableHead compatibility
interface MuiTableHeadProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

export const TableHead = React.forwardRef<HTMLTableSectionElement, MuiTableHeadProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <TableHeader ref={ref} className={className} {...props}>
        {children}
      </TableHeader>
    );
  }
);

TableHead.displayName = 'TableHead';

// TableBody compatibility
interface MuiTableBodyProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

export const TableBody = React.forwardRef<HTMLTableSectionElement, MuiTableBodyProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <ShadcnTableBody ref={ref} className={className} {...props}>
        {children}
      </ShadcnTableBody>
    );
  }
);

TableBody.displayName = 'TableBody';

// TableRow compatibility
interface MuiTableRowProps {
  children?: React.ReactNode;
  hover?: boolean;
  selected?: boolean;
  sx?: Record<string, any>;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLTableRowElement>) => void;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, MuiTableRowProps>(
  ({ children, hover, selected, className, ...props }, ref) => {
    return (
      <ShadcnTableRow
        ref={ref}
        data-state={selected ? 'selected' : undefined}
        className={cn(
          hover && 'hover:bg-muted/50 cursor-pointer',
          selected && 'bg-muted',
          className
        )}
        {...props}
      >
        {children}
      </ShadcnTableRow>
    );
  }
);

TableRow.displayName = 'TableRow';

// TableCell compatibility
interface MuiTableCellProps {
  children?: React.ReactNode;
  align?: 'left' | 'center' | 'right' | 'justify' | 'inherit';
  padding?: 'normal' | 'checkbox' | 'none';
  size?: 'small' | 'medium';
  variant?: 'head' | 'body' | 'footer';
  sx?: Record<string, any>;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}

export const TableCell = React.forwardRef<HTMLTableCellElement, MuiTableCellProps>(
  ({ children, align = 'left', padding = 'normal', size, variant = 'body', className, ...props }, ref) => {
    const alignClass = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
      inherit: '',
    }[align];

    const paddingClass = {
      normal: 'p-2',
      checkbox: 'w-12 px-2',
      none: 'p-0',
    }[padding];

    const Component = variant === 'head' ? ShadcnTableHead : ShadcnTableCell;

    return (
      <Component
        ref={ref}
        className={cn(alignClass, paddingClass, className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

TableCell.displayName = 'TableCell';

// TableFooter compatibility
interface MuiTableFooterProps {
  children?: React.ReactNode;
  sx?: Record<string, any>;
  className?: string;
}

export const MuiTableFooter = React.forwardRef<HTMLTableSectionElement, MuiTableFooterProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <TableFooter ref={ref} className={className} {...props}>
        {children}
      </TableFooter>
    );
  }
);

MuiTableFooter.displayName = 'TableFooter';

// TablePagination compatibility (basic implementation)
interface TablePaginationProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  rowsPerPageOptions?: number[];
  className?: string;
}

export const TablePagination = React.forwardRef<HTMLDivElement, TablePaginationProps>(
  ({ count, page, rowsPerPage, onPageChange, onRowsPerPageChange, rowsPerPageOptions = [10, 25, 50], className }, ref) => {
    const totalPages = Math.ceil(count / rowsPerPage);
    const startRow = page * rowsPerPage + 1;
    const endRow = Math.min((page + 1) * rowsPerPage, count);

    return (
      <div ref={ref} className={cn('flex items-center justify-between px-2 py-3', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>페이지당 행:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => onRowsPerPageChange?.(e)}
            className="border rounded px-2 py-1"
          >
            {rowsPerPageOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {startRow}-{endRow} / {count}
          </span>
          <div className="flex gap-1">
            <button
              onClick={(e) => onPageChange(e, page - 1)}
              disabled={page === 0}
              className="p-1 disabled:opacity-50"
            >
              ←
            </button>
            <button
              onClick={(e) => onPageChange(e, page + 1)}
              disabled={page >= totalPages - 1}
              className="p-1 disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>
      </div>
    );
  }
);

TablePagination.displayName = 'TablePagination';