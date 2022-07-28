import React, { useEffect, useState } from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import DropMenu from '../../components/DropMenu';
import ChipList from '../../components/ChipList';

function DataTable(props) {
  const title: string = props.title ? props.title : '';
  const minHeight: number = props.minHeight ? props.minHeight : '100%';

  return (
    <Paper sx={{ minHeight: minHeight }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', px: 4, py: 2 }}>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {props.dropMenu ? <DropMenu /> : ''}
      </Stack>
      <Divider />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          listStyle: 'none',
          p: 0,
          px: 3,
          pb: 4,
        }}
        component="ul"
      >
        <ChipList fastCreate={props.fastCreate} edit={props.edit} />
      </Box>
    </Paper>
  );
}

export default DataTable;
