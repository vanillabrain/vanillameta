import React from 'react';
import { Divider, Typography } from '@mui/material';

function PageTitle(props) {
  const title = props.title ? props.title : '';

  return (
    <React.Fragment>
      <Typography variant="h5" component="h2" pt={6} mb={2}>
        {title}
      </Typography>
      <Divider />
    </React.Fragment>
  );
}

export default PageTitle;
