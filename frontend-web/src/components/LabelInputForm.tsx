import React from 'react';
import { List, ListItem, Stack, TextField } from '@mui/material';
import SubmitButton from './SubmitButton';

function LabelInputForm(props) {
  const handleSubmit = data => {
    data.preventDefault();
    const userData = {
      userName: data.target.userName.value,
      userHost: data.target.userHost.value,
      userPort: data.target.userPort.value,
      userId: data.target.userId.value,
      userPassword: data.target.userPassword.value,
      userSchema: data.target.userSchema.value,
    };
    console.log(userData);
  };

  return (
    <Stack component="form" sx={{ maxWidth: 700, mx: 'auto', mt: 3 }} onSubmit={handleSubmit}>
      <List sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {props.data.map(item => (
          <ListItem key={item.id} sx={{ width: { xs: '100%', sm: item.width || '100%' } }}>
            <TextField id={item.id} label={item.label} type={item.type || 'none'} required fullWidth />
          </ListItem>
        ))}
        <ListItem>
          <SubmitButton label="Test Connect" type="submit" />
        </ListItem>
      </List>
    </Stack>
  );
}

export default LabelInputForm;
