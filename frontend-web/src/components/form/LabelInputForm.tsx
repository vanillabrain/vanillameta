import React from 'react';
import { List, ListItem, Stack, TextField } from '@mui/material';
import SubmitButton from '../button/SubmitButton';

const LabelInputForm = props => {
  const { testConnect, formData, setFormData } = props;
  const handleSubmit = data => {
    data.preventDefault();
    const item = {
      name: data.target.databaseName.value,
      host: data.target.host.value,
      port: data.target.port.value,
      user: data.target.user.value,
      password: data.target.password.value,
      database: data.target.schema.value,
    };
    testConnect(item);
  };

  const handleChange = event => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
  };

  return (
    <Stack component="form" sx={{ maxWidth: 700, mx: 'auto', mt: 3 }} onSubmit={handleSubmit}>
      <List sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {props.data.map(item => (
          <ListItem key={item.id} sx={{ width: { xs: '100%', sm: item.width || '100%' } }}>
            <TextField
              id={item.id}
              label={item.label}
              type={item.type || 'none'}
              name={item.name}
              required
              fullWidth
              onChange={handleChange}
            />
          </ListItem>
        ))}
        <ListItem>
          <SubmitButton label="Test Connect" type="submit" />
        </ListItem>
      </List>
    </Stack>
  );
};

export default LabelInputForm;
