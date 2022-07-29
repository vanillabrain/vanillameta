import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import DropMenu from '../../components/DropMenu';
import CardList from '../../components/CardList';

function DataTable(props) {
  const title: string = props.title ? props.title : '';
  const minHeight: number = props.minHeight ? props.minHeight : '100%';

  return (
    <Box
      sx={{
        // minHeight: minHeight,
        width: '100%',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', py: 1 }}>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {props.dropMenu ? <DropMenu menuList={props.menuList} /> : ''}
      </Stack>
      <Divider />
      <CardList
        data={props.data}
        fastCreate={props.fastCreate}
        edit={props.edit}
        delete={props.delete}
        cardWidth={props.cardWidth}
      />
    </Box>
  );
}

export default DataTable;
