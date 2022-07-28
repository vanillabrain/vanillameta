import React from 'react';
import { styled } from '@mui/material/styles';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';

const StyledListItem = styled('li')(({ theme }) => ({
  // TODO: 클릭할 수 있는 버튼이나 카드로 바꾸기
  margin: theme.spacing(1),
  '& > div': {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: 'auto',
    padding: 4,
    paddingLeft: 16,
    gap: 18,
    borderRadius: 30,
    backgroundColor: theme.palette.grey['200'],
    boxShadow: 0,
  },
  '& .MuiIconButton-root': {
    padding: 1,
  },
}));

const chipData = [
  { key: 0, label: 'Angular' },
  { key: 1, label: 'jQuery' },
  { key: 2, label: 'Polymer' },
  { key: 3, label: 'React' },
  { key: 4, label: 'Angular' },
  { key: 5, label: 'jQuery' },
  { key: 6, label: 'Polymer' },
  { key: 7, label: 'React' },
  { key: 8, label: 'Vue.js' },
];

function ChipList(props) {
  return (
    <React.Fragment>
      {chipData.map(data => (
        <StyledListItem key={data.key}>
          <Stack direction="row" spacing={0.5}>
            <Typography sx={{ fontSize: 14 }}>{data.label}</Typography>
            <Box>
              {props.fastCreate ? (
                <IconButton>
                  <AutoAwesomeIcon />
                </IconButton>
              ) : (
                ''
              )}
              {props.edit ? (
                <IconButton>
                  <EditIcon />
                </IconButton>
              ) : (
                ''
              )}
              <IconButton>
                <CancelIcon />
              </IconButton>
            </Box>
          </Stack>
        </StyledListItem>
      ))}
    </React.Fragment>
  );
}

export default ChipList;
