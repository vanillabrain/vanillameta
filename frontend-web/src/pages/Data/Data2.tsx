import React from 'react';
import { Box, Container, Divider, Grid, Paper, Typography, Chip, styled, Stack, IconButton } from '@mui/material';

import DropButton from '../../components/DropButton';
import ChipList from '../../components/ChipList';

const title = 'Data';

function Data2(props) {
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
                  <ChipList />
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
