import React from 'react';
import { Box, Container, Divider, Grid, Paper, Typography, Chip, styled, Stack, IconButton } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';

import DropButton from '../../components/DropButton';

const title = 'Data';

const StyledListItem = styled('li')(({ theme }) => ({
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

function Data2(props) {
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
    <Box sx={{ minHeight: 600, backgroundColor: '#f3f4f6' }}>
      <Container sx={{ maxWidth: 1152, m: 'auto', p: 9 }}>
        <Typography variant="h5" component="h2" mb={3}>
          {title}
        </Typography>
        <Divider />
        <Box mt={3} mb={3}>
          <Grid container spacing={3}>
            <Grid item xs={4}>
              <Paper sx={{ height: 650 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', p: 2 }}>
                  <Typography variant="subtitle1" component="h3">
                    header
                  </Typography>
                  <DropButton />
                </Stack>
                <Divider />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    listStyle: 'none',
                    p: 0.5,
                    m: 0,
                    mt: 2,
                  }}
                  component="ul"
                >
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
                </Box>
              </Paper>
            </Grid>
            <Grid item xs>
              <Paper sx={{ height: 300, mb: 3 }}>dd</Paper>
              <Divider />
              <Paper sx={{ height: 300, mt: 3 }}>dd</Paper>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}

export default Data2;
