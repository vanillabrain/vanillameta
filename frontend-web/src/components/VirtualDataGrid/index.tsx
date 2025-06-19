import React, { useMemo, useCallback, CSSProperties } from 'react';
import { VariableSizeList as List } from 'react-window';
import {
  Box,
  Paper,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  useTheme,
} from '@mui/material';

interface VirtualDataGridProps {
  data: any[];
  columns: Array<{
    field: string;
    headerName: string;
    width?: number;
  }>;
  height?: number;
  rowHeight?: number;
  headerHeight?: number;
  isLoading?: boolean;
}

// 각 행을 렌더링하는 컴포넌트
const Row = React.memo(
  ({ index, style, data }: { index: number; style: CSSProperties; data: { items: any[]; columns: any[] } }) => {
    const { items, columns } = data;
    const row = items[index];

    if (!row) return null;

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: index % 2 === 0 ? '#f5f5f5' : '#ffffff',
        }}
      >
        {columns.map((column, colIndex) => (
          <div
            key={`${index}-${colIndex}`}
            style={{
              flex: column.width ? `0 0 ${column.width}px` : 1,
              padding: '0 16px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row[column.field] !== null && row[column.field] !== undefined ? String(row[column.field]) : '-'}
          </div>
        ))}
      </div>
    );
  },
);

Row.displayName = 'Row';

const VirtualDataGrid: React.FC<VirtualDataGridProps> = ({
  data,
  columns,
  height = 600,
  rowHeight = 48,
  headerHeight = 56,
  isLoading = false,
}) => {
  const theme = useTheme();

  // 전체 너비 계산
  const totalWidth = useMemo(() => {
    return columns.reduce((sum, col) => sum + (col.width || 150), 0);
  }, [columns]);

  // 행 높이 함수
  const getItemSize = useCallback(() => rowHeight, [rowHeight]);

  // 리스트 데이터
  const itemData = useMemo(
    () => ({
      items: data,
      columns,
    }),
    [data, columns],
  );

  if (data.length === 0 && !isLoading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">데이터가 없습니다.</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <Box
        sx={{
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          borderBottom: `2px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.grey[100],
          fontWeight: 600,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {columns.map((column, index) => (
          <Box
            key={index}
            sx={{
              flex: column.width ? `0 0 ${column.width}px` : 1,
              px: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {column.headerName}
          </Box>
        ))}
      </Box>

      {/* 가상 스크롤 리스트 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <List
          height={height - headerHeight}
          itemCount={data.length}
          itemSize={getItemSize}
          width="100%"
          itemData={itemData}
          overscanCount={10} // 스크롤 성능 최적화를 위한 미리 렌더링할 항목 수
        >
          {Row}
        </List>
      </Box>

      {/* 로딩 중 표시 */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            px: 2,
            py: 1,
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" color="primary">
            추가 데이터를 로드하는 중...
          </Typography>
        </Box>
      )}

      {/* 데이터 개수 표시 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 16,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          px: 1,
          borderRadius: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          총 {data.length.toLocaleString()} 행
        </Typography>
      </Box>
    </Paper>
  );
};

export default VirtualDataGrid;
