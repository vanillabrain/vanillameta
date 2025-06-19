import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Box, Typography } from '@mui/material';

interface TopEvent {
  action: string;
  category: string;
  count: number;
}

interface Props {
  topEvents: TopEvent[];
}

const TopEventsTable: React.FC<Props> = ({ topEvents }) => {
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Dashboard: '#1976d2',
      Widget: '#388e3c',
      Database: '#f57c00',
      User: '#7b1fa2',
      Navigation: '#00796b',
      Dataset: '#c2185b',
    };
    return colors[category] || '#757575';
  };

  const formatActionName = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>이벤트</TableCell>
            <TableCell>카테고리</TableCell>
            <TableCell align="right">횟수</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {topEvents.length > 0 ? (
            topEvents.slice(0, 10).map((event, index) => (
              <TableRow key={index} hover>
                <TableCell>
                  <Typography variant="body2">{formatActionName(event.action)}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={event.category}
                    size="small"
                    sx={{
                      backgroundColor: getCategoryColor(event.category) + '20',
                      color: getCategoryColor(event.category),
                      fontWeight: 'medium',
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {event.count.toLocaleString()}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} align="center">
                <Typography variant="body2" color="text.secondary">
                  데이터가 없습니다
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TopEventsTable;
