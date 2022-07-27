import React, { useState } from 'react';
import { alpha, styled } from '@mui/material/styles';
import Menu from '@mui/material/Menu';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';

const StyledListItem = styled('li')(({ theme }) => ({
  // TODO: 클릭할 수 있는 버튼이나 카드로 바꾸기
  margin: theme.spacing(0.8),
  '& > div': {
    justifyContent: 'space-between',
    alignItems: 'center',
    minWidth: 250,
    minHeight: 40,
    padding: 5,
    paddingLeft: 20,
    borderRadius: 30,
    fontSize: 16,
    // color: '#fff',
    backgroundColor: theme.palette.grey['200'],
    // backgroundColor: theme.palette.primary.dark,
    boxShadow: 0,

    '& .MuiIconButton-root': {
      // color: 'rgba(255, 255, 255, 0.7)',
    },
  },
}));

function ChipList(props) {

  const [chipData, setChipData] = React.useState([
    { key: 0, label: 'Angular' },
    { key: 1, label: 'jQuery' },
    { key: 2, label: 'Polymer' },
    { key: 3, label: 'React' },
    { key: 4, label: 'Vue.js' },
  ]);

  const handleDelete = chipToDelete => () => {
    setChipData(chips => chips.filter(chip => chip.key !== chipToDelete.key));
  };

  return (
    {chipData.map(data => (
        <StyledListItem key={data.key}>
          <Stack direction="row" spacing={0.5}>
            <Typography>{data.label}</Typography>
            <Box>
              <IconButton>
                <AutoAwesomeIcon />
              </IconButton>
              <IconButton>
                <EditIcon />
              </IconButton>
              <IconButton>
                <CancelIcon />
              </IconButton>
            </Box>
          </Stack>
          {/*<Chip*/}
          {/*  icon={*/}
          {/*    <React.Fragment>*/}
          {/*      <AutoAwesomeIcon />*/}
          {/*      <EditIcon />*/}
          {/*    </React.Fragment>*/}
          {/*  }*/}
          {/*  color="primary"*/}
          {/*  clickable={true}*/}
          {/*  label={data.label}*/}
          {/*  onDelete={handleDelete(data)}*/}
          {/*/>*/}
        </StyledListItem>

      ))}
  );
}

export default ChipList;