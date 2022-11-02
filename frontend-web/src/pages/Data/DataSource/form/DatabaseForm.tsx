import React from 'react';
import { Stack, TextField } from '@mui/material';
import SubmitButton from '@/components/button/SubmitButton';

const inputStyle = {
  width: '800px',
};

const DatabaseForm = props => {
  const { testConnect, formData, setFormData } = props;
  const handleSubmit = data => {
    data.preventDefault();
    const item = {
      databaseName: data.target.databaseName.value,
      host: data.target.host.value,
      port: Number(data.target.port.value),
      user: data.target.user.value,
      password: data.target.password.value,
      database: data.target.database.value,
    };
    testConnect(item);
  };

  const handleChange = event => {
    setFormData(prevState => ({ ...prevState, mysql2: { ...prevState.mysql2, [event.target.name]: event.target.value } }));
  };

  return (
    <Stack component="form" sx={{ maxWidth: 800, mx: 'auto', mt: 3 }} onSubmit={handleSubmit}>
      <Stack sx={{ display: 'flex', justifyContent: 'space-between' }} spacing="20px">
        <TextField
          label="이름"
          name="databaseName"
          value={formData?.databaseName || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Host"
          name="host"
          value={formData?.host || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Port"
          name="port"
          type="number"
          value={formData?.port || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="User"
          name="user"
          value={formData?.user || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={formData?.password || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Schema"
          name="database"
          value={formData?.database || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <SubmitButton label="Test Connect" type="submit" />
      </Stack>
    </Stack>
  );
};

export default DatabaseForm;
