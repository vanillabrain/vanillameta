import React from 'react';
import { Stack, TextField } from '@mui/material';
import SubmitButton from '@/components/button/SubmitButton';

const SnowflakeDatabaseForm = props => {
  const { testConnect, formData, setFormData } = props;
  const handleSubmit = data => {
    data.preventDefault();
    const item = {
      name: data.target.name.value,
      account: data.target.account.value,
      username: data.target.username.value,
      password: data.target.password.value,
      database: data.target.database.value,
      application: data.target.application.value,
      schema: data.target.schema.value,
      warehouse: data.target.warehouse.value,
    };
    testConnect(item);
  };

  const handleNameChange = event => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
  };

  const handleChange = event => {
    setFormData(prevState => ({
      ...prevState,
      snowflake: { ...prevState.snowflake, [event.target.name]: event.target.value },
    }));
  };

  return (
    <Stack component="form" sx={{ maxWidth: '800px', width: '100%', mx: 'auto', mt: 3 }} onSubmit={handleSubmit}>
      <Stack sx={{ display: 'flex', justifyContent: 'space-between' }} spacing="20px">
        <TextField label="이름" name="name" value={formData?.name || ''} required fullWidth onChange={handleNameChange} />
        <TextField
          label="Account"
          name="account"
          value={formData?.snowflake?.account || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Username"
          name="username"
          value={formData?.snowflake?.username || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Password"
          name="password"
          value={formData?.snowflake?.password || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Database"
          name="database"
          value={formData?.snowflake?.database || ''}
          required
          fullWidth
          onChange={handleChange}
        />{' '}
        <TextField
          label="Application"
          name="application"
          value={formData?.snowflake?.application || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Schema"
          name="schema"
          value={formData?.snowflake?.schema || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Warehouse"
          name="warehouse"
          value={formData?.snowflake?.warehouse || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <SubmitButton label="TEST CONNECT" type="submit" sx={{ height: '50px', fontSize: '13px' }} />
      </Stack>
    </Stack>
  );
};

export default SnowflakeDatabaseForm;
