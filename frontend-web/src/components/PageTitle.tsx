import React from 'react';
import { Box, Breadcrumbs, Divider, Stack, Typography, Link, IconButton } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

function PageTitle(props) {
  const title = props.title ? props.title : '';
  const subTitle = props.subTitle ? props.subTitle : '';

  function handleClick(event) {
    event.preventDefault();
    console.info('You clicked a breadcrumb.');
  }

  const breadcrumbs = [
    <Link underline="hover" key="1" color="inherit" href="/" onClick={handleClick}>
      <IconButton size="small">
        <HomeIcon />
      </IconButton>
    </Link>,
    <Typography key="3" color="text.body" sx={{ pl: 1, fontSize: 14 }}>
      {subTitle}
    </Typography>,
  ];

  return (
    <React.Fragment>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={4}>
        <Typography variant="h5" component="h2" pt={6} mb={2}>
          {title}
        </Typography>

        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" sx={{ fontSize: 14 }}>
          {breadcrumbs}
        </Breadcrumbs>
      </Stack>
      <Divider sx={{ mb: 6 }} />
    </React.Fragment>
  );
}

export default PageTitle;
