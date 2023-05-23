import Grid from '@toast-ui/react-grid';
import React, { HTMLAttributes, useRef } from 'react';
import { GridEventListener, GridOptions } from 'tui-grid';
import { Stack } from '@mui/material';

type EventNameMapping = {
  onClick: 'click';
  onDblclick: 'dblclick';
  onMousedown: 'mousedown';
  onMouseover: 'mouseover';
  onMouseout: 'mouseout';
  onFocusChange: 'focusChange';
  onColumnResize: 'columnResize';
  onCheck: 'check';
  onUncheck: 'uncheck';
  onCheckAll: 'checkAll';
  onUncheckAll: 'uncheckAll';
  onSelection: 'selection';
  onEditingStart: 'editingStart';
  onEditingFinish: 'editingFinish';
  onSort: 'sort';
  onFilter: 'filter';
  onScrollEnd: 'scrollEnd';
  onBeforeRequest: 'beforeRequest';
  onResponse: 'response';
  onSuccessResponse: 'successResponse';
  onFailResponse: 'failResponse';
  onErrorResponse: 'errorResponse';
};

type EventMaps = {
  [K in keyof EventNameMapping]?: GridEventListener;
};

type Props = Omit<GridOptions, 'el'> &
  EventMaps &
  HTMLAttributes<HTMLElement> & {
    oneTimeBindingProps?: Array<'data' | 'columns' | 'bodyHeight' | 'frozenColumnCount'>;
  };

export const DataGridWrapper = ({ children }: React.PropsWithChildren) => {
  return (
    <Stack
      sx={{
        flex: 1,
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
      }}
    >
      {children}
    </Stack>
  );
};

const DataGrid = (props: Props) => {
  const gridRef = useRef();

  return (
    <Grid
      ref={gridRef}
      header={{
        height: 36,
        align: 'center',
      }}
      rowHeight={36}
      minRowHeight={36}
      minBodyHeight={100}
      usageStatistics={true}
      columnOptions={{
        resizable: true,
      }}
      {...props}
    />
  );
};

export default DataGrid;
