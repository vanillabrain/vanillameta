import React from 'react';
import { Stack, TextField } from '@mui/material';
import SubmitButton from '@/components/button/SubmitButton';

const DatabaseForm = props => {
  const { testConnect, formData, setFormData } = props;
  const handleSubmit = data => {
    data.preventDefault();
    const item = {
      name: data.target.name.value,
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
      <Stack sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <TextField
          label="이름"
          name="databaseName"
          value={formData.databaseName}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField label="Host" name="host" value={formData.host} required fullWidth onChange={handleChange} />
        <TextField label="Port" name="port" value={formData.port} required fullWidth onChange={handleChange} />
        <TextField label="User" name="user" value={formData.user} required fullWidth onChange={handleChange} />
        <TextField label="Password" name="password" value={formData.password} required fullWidth onChange={handleChange} />
        <TextField label="Schema" name="database" value={formData.database} required fullWidth onChange={handleChange} />
        <SubmitButton label="Test Connect" type="submit" />
      </Stack>
    </Stack>
  );
};

export default DatabaseForm;
