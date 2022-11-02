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
      name: data.target.name.value,
      host: data.target.host.value,
      port: Number(data.target.port.value),
      user: data.target.user.value,
      password: data.target.password.value,
      database: data.target.database.value,
    };
    testConnect(item);
  };

  const handleNameChange = event => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
  };

  const handleChange = event => {
    setFormData(prevState => ({ ...prevState, default: { ...prevState.default, [event.target.name]: event.target.value } }));
  };

  return (
    <Stack component="form" sx={{ maxWidth: 800, mx: 'auto', mt: 3 }} onSubmit={handleSubmit}>
      <Stack sx={{ display: 'flex', justifyContent: 'space-between' }} spacing="20px">
        <TextField
          label="이름"
          name="name"
          value={formData?.name || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleNameChange}
        />
        <TextField
          label="Host"
          name="host"
          value={formData?.default?.host || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Port"
          name="port"
          type="number"
          value={formData?.default?.port || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="User"
          name="user"
          value={formData?.default?.user || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={formData?.default?.password || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Schema"
          name="database"
          value={formData?.default?.database || ''}
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
