import React, {
  forwardRef,
  HTMLAttributes,
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataGridColumn {
  name: string;
  header?: React.ReactNode;
  minWidth?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc';

export interface DataGridHandle {
  getData: () => any;
  getRow: (rowKey: string | number) => any;
  getCheckedRows: () => any[];
  refreshLayout: () => void;
  resetData: (nextData?: any) => void;
}

export interface DataGridProps {
  data?: any;
  columns?: DataGridColumn[];
  bodyHeight?: number | string;
  minBodyHeight?: number;
  columnOptions?: { resizable?: boolean; [key: string]: any };
  resizeObserver?: any;
  checkable?: boolean;
  className?: string;
  onCheck?: (row: any) => void;
  onUncheck?: (row: any) => void;
  onCheckAll?: () => void;
  onUncheckAll?: () => void;
  [key: string]: any;
}

const rowKeyOf = (row, index) => (row && (row.rowKey ?? row.row_key) !== undefined ? row.rowKey ?? row.row_key : index);

/** Grid engines mutate the rows they render, so callers must receive their own object graph. */
export const cloneGridRows = rows => {
  const cloneValue = value => {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
    }
    return value;
  };

  return rows.map(row => ({
    ...row,
    ...(row._attributes ? { _attributes: cloneValue(row._attributes) } : {}),
  }));
};

const isBlankValue = value => (typeof value === 'string' ? value.length === 0 : value === undefined || value === null);
const convertToNumber = value =>
  typeof value === 'number' || Number.isNaN(Number(value)) || isBlankValue(value) ? value : Number(value);

/** Matches the previous grid comparator: blanks sort first ascending and numeric strings compare numerically. */
export const compareGridValues = (valueA, valueB) => {
  const blankA = isBlankValue(valueA);
  const blankB = isBlankValue(valueB);
  let convertedA = convertToNumber(valueA);
  let convertedB = convertToNumber(valueB);
  if (typeof convertedA !== 'number' || typeof convertedB !== 'number') {
    convertedA = String(valueA);
    convertedB = String(valueB);
  }
  if (blankA && !blankB) return -1;
  if (!blankA && blankB) return 1;
  if (convertedA < convertedB) return -1;
  if (convertedA > convertedB) return 1;
  return 0;
};

const cellText = value => (value === null || value === undefined ? '' : String(value));

const MIN_COLUMN_WIDTH = 40;
const RESIZE_KEYBOARD_STEP = 16;

export const DataGridWrapper = forwardRef<HTMLDivElement, PropsWithChildren<HTMLAttributes<HTMLElement>>>((props, ref) => {
  const { children, className, ...rest } = props;
  return (
    <div
      {...rest}
      ref={ref}
      data-slot="datagrid-wrapper"
      className={cn('flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden', className)}
    >
      {children}
    </div>
  );
});

DataGridWrapper.displayName = 'DataGridWrapper';

const DataGrid = forwardRef<DataGridHandle, DataGridProps>((props, ref) => {
  const {
    data,
    columns = [],
    bodyHeight,
    minBodyHeight = 100,
    columnOptions = { resizable: true },
    resizeObserver,
    checkable = false,
    className,
    onCheck,
    onUncheck,
    onCheckAll,
    onUncheckAll,
    ...rest
  } = props;
  const [dataOverride, setDataOverride] = useState<any>(undefined);
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ name: string; startX: number; startWidth: number; minWidth: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const [, setLayoutRevision] = useState(0);

  const sourceData = dataOverride === undefined ? data : dataOverride;
  const isRowCollection = Array.isArray(sourceData);

  const renderRows = useMemo(
    () => (isRowCollection ? cloneGridRows(sourceData) : sourceData),
    [isRowCollection, sourceData],
  );

  useEffect(() => {
    if (!Array.isArray(sourceData)) {
      setCheckedKeys([]);
      return;
    }
    setCheckedKeys(
      sourceData
        .map((row, sourceIndex) => ({ row, key: String(rowKeyOf(row, sourceIndex)) }))
        .filter(entry => entry.row?._attributes?.checked)
        .map(entry => entry.key),
    );
  }, [sourceData]);

  useEffect(() => {
    // Container resize no longer re-lays out an internal canvas; re-render keeps the widget contract.
    setLayoutRevision(revision => revision + 1);
  }, [resizeObserver]);

  useEffect(() => {
    if (!resizing) {
      return undefined;
    }
    const handleMove = event => {
      const active = resizeRef.current;
      if (!active) {
        return;
      }
      const point = event.touches?.[0] ?? event;
      const nextWidth = Math.max(active.minWidth, Math.round(active.startWidth + (point.clientX - active.startX)));
      setColumnWidths(current => ({ ...current, [active.name]: nextWidth }));
    };
    const handleEnd = () => {
      resizeRef.current = null;
      setResizing(false);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [resizing]);

  // Source indices become stable row keys before sorting, so selection survives re-ordering.
  const entryRows = useMemo(
    () => (isRowCollection ? renderRows.map((row, sourceIndex) => ({ row, key: String(rowKeyOf(row, sourceIndex)) })) : []),
    [isRowCollection, renderRows],
  );

  const orderedEntries = useMemo(() => {
    const withChecks = entryRows.map(entry => {
      const checked = checkedKeys.includes(entry.key);
      if (Boolean(entry.row?._attributes?.checked) === checked) return entry;
      return { ...entry, row: { ...entry.row, _attributes: { ...(entry.row._attributes ?? {}), checked } } };
    });
    if (!sort) return withChecks;
    const sorted = [...withChecks];
    sorted.sort((left, right) => {
      const result = compareGridValues(left.row?.[sort.key], right.row?.[sort.key]);
      return sort.direction === 'asc' ? result : -result;
    });
    return sorted;
  }, [entryRows, checkedKeys, sort]);

  const gridRows = useMemo(
    () => (isRowCollection ? orderedEntries.map(entry => entry.row) : sourceData),
    [isRowCollection, orderedEntries, sourceData],
  );

  const rowKeys = useMemo(() => orderedEntries.map(entry => entry.key), [orderedEntries]);

  const checkedRows = () => orderedEntries.filter(entry => checkedKeys.includes(entry.key)).map(entry => entry.row);

  useImperativeHandle(ref, () => ({
    getData: () => gridRows,
    getRow: rowKey => {
      if (!Array.isArray(gridRows)) return undefined;
      const position = rowKeys.indexOf(String(rowKey));
      return position >= 0 ? gridRows[position] : gridRows[Number(rowKey)];
    },
    getCheckedRows: checkedRows,
    refreshLayout: () => setLayoutRevision(revision => revision + 1),
    resetData: nextData => {
      setSort(null);
      setCheckedKeys([]);
      setDataOverride(nextData);
    },
  }));

  const toggleSort = columnName => {
    setSort(current => {
      if (current?.key !== columnName) return { key: columnName, direction: 'asc' };
      return { key: columnName, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const toggleRow = entry => {
    const { row, key } = entry;
    const isChecked = checkedKeys.includes(key);
    setCheckedKeys(current => (isChecked ? current.filter(entry => entry !== key) : current.concat([key])));
    if (isChecked) {
      onUncheck?.(row);
    } else {
      onCheck?.(row);
    }
  };

  const toggleAll = () => {
    if (!isRowCollection) return;
    const allChecked = rowKeys.length > 0 && rowKeys.every(key => checkedKeys.includes(key));
    setCheckedKeys(allChecked ? [] : [...rowKeys]);
    if (allChecked) {
      onUncheckAll?.();
    } else {
      onCheckAll?.();
    }
  };

  const bodyStyle: React.CSSProperties = {
    ...(typeof bodyHeight === 'number' ? { height: bodyHeight, maxHeight: bodyHeight } : {}),
    ...(bodyHeight === 'fitToParent' ? { height: '100%' } : {}),
    ...(typeof minBodyHeight === 'number' ? { minHeight: minBodyHeight } : {}),
  };

  const isAllChecked = isRowCollection && rowKeys.length > 0 && rowKeys.every(key => checkedKeys.includes(key));

  // The previous grid enabled column resizing by default and only opted out on an explicit false.
  const resizable = columnOptions?.resizable !== false;
  const columnWidth = column => columnWidths[column.name] ?? column.width ?? column.minWidth ?? undefined;
  const cellStyle = column => ({
    ...(columnWidth(column) !== undefined ? { width: columnWidth(column) } : {}),
    minWidth: columnWidths[column.name] ?? column.minWidth,
    textAlign: column.align,
  });
  const startResize = (event, column) => {
    const point = event.touches?.[0] ?? event;
    const renderedWidth = event.currentTarget?.parentElement?.getBoundingClientRect?.().width;
    resizeRef.current = {
      name: column.name,
      startX: point.clientX,
      minWidth: Math.max(MIN_COLUMN_WIDTH, column.minWidth ?? 0),
      startWidth: renderedWidth > 0 ? renderedWidth : columnWidth(column) ?? MIN_COLUMN_WIDTH,
    };
    setResizing(true);
  };
  const handleResizeKeyDown = (event, column) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const current = columnWidth(column) ?? MIN_COLUMN_WIDTH;
    const nextWidth = current + (event.key === 'ArrowRight' ? RESIZE_KEYBOARD_STEP : -RESIZE_KEYBOARD_STEP);
    setColumnWidths(widths => ({
      ...widths,
      [column.name]: Math.max(MIN_COLUMN_WIDTH, column.minWidth ?? 0, Math.round(nextWidth)),
    }));
  };

  return (
    <div
      {...rest}
      data-slot="datagrid"
      className={cn('flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border bg-card', className)}
    >
      <div className="min-h-0 w-full flex-1 overflow-auto" style={bodyStyle}>
        <Table className="w-full border-collapse text-sm">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="h-9">
              {checkable && (
                <TableHead className="w-10">
                  <Checkbox aria-label="grid.checkAll" checked={isAllChecked} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              {columns.map(column => {
                const sortable = Boolean(column.sortable);
                const sorted = sort?.key === column.name;
                return (
                  <TableHead
                    key={column.name}
                    data-column-name={column.name}
                    scope="col"
                    aria-sort={sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    style={cellStyle(column)}
                    className="relative text-muted-foreground"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!sortable}
                      onClick={sortable ? () => toggleSort(column.name) : undefined}
                      className={cn(
                        'h-auto w-full justify-start gap-1 rounded-md px-1 py-1 text-left font-medium',
                        sortable ? 'cursor-pointer' : 'cursor-default',
                      )}
                      style={{ textAlign: column.align }}
                    >
                      <span className="truncate">{column.header ?? column.name}</span>
                      {sorted && <span aria-hidden="true">{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                    </Button>
                    {resizable && column.resizable !== false && (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={'Resize column ' + column.name}
                        tabIndex={0}
                        data-column-resize={column.name}
                        onMouseDown={event => startResize(event, column)}
                        onTouchStart={event => startResize(event, column)}
                        onKeyDown={event => handleResizeKeyDown(event, column)}
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40"
                      />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray(gridRows) &&
              orderedEntries.map((entry, index) => {
                const { row } = entry;
                const key = rowKeys[index];
                return (
                  <TableRow key={key} data-row-key={key} className="h-9">
                    {checkable && (
                      <TableCell className="w-10">
                        <Checkbox
                          aria-label={'grid.checkRow ' + key}
                          checked={checkedKeys.includes(key)}
                          onCheckedChange={() => toggleRow(entry)}
                        />
                      </TableCell>
                    )}
                    {columns.map(column => (
                      <TableCell key={column.name} data-column-name={column.name} style={cellStyle(column)}>
                        <span data-slot="datagrid-cell" className="block truncate">
                          {cellText(row?.[column.name])}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});

DataGrid.displayName = 'DataGrid';

export default DataGrid;
