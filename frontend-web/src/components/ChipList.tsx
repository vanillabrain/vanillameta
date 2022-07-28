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

function ChipList(props) {
  return (
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
      {props.data.map(data => (
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
    </Box>
  );
}

export default ChipList;
