import React, { forwardRef, PropsWithChildren } from 'react';
import { Stack } from '@mui/material';
import { DataGrid as MuiDataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';

export const DataGridWrapper = forwardRef((props: PropsWithChildren, ref: React.Ref<HTMLDivElement>) => {
  const { children } = props;
  return (
    <Stack
      ref={ref}
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
});

interface DataGridProps {
  rows?: GridRowsProp;
  columns?: GridColDef[];
  data?: any[];
  resizeObserver?: any;
  [key: string]: any;
}

const DataGrid = ({ rows, columns, data, resizeObserver, ...rest }: DataGridProps) => {
  // TUI Grid의 data prop을 MUI DataGrid의 rows로 변환
  const gridRows = rows || (data?.map((item, index) => ({ id: index, ...item })) ?? []);
  
  // TUI Grid의 columns를 MUI DataGrid 형식으로 변환
  const gridColumns: GridColDef[] = columns || [];

  return (
    <MuiDataGrid
      rows={gridRows}
      columns={gridColumns}
      pageSizeOptions={[5, 10, 25, 50, 100]}
      initialState={{
        pagination: {
          paginationModel: { pageSize: 25 },
        },
      }}
      sx={{
        '& .MuiDataGrid-cell': {
          fontSize: '0.875rem',
        },
        '& .MuiDataGrid-columnHeader': {
          backgroundColor: '#f5f5f5',
          fontSize: '0.875rem',
        },
      }}
      {...rest}
    />
  );
};

export default DataGrid;