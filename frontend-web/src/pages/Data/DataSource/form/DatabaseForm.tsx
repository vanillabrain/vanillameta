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
    <Stack component="form" sx={{ maxWidth: '800px', width: '100%', mx: 'auto', mt: 3 }} onSubmit={handleSubmit}>
      <Stack sx={{ display: 'flex', justifyContent: 'space-between' }} spacing="20px">
        <TextField label="이름" name="name" value={formData?.name || ''} required fullWidth onChange={handleNameChange} />
        <TextField
          label="Host"
          name="host"
          value={formData?.default?.host || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Port"
          name="port"
          type="number"
          value={formData?.default?.port || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="User"
          name="user"
          value={formData?.default?.user || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={formData?.default?.password || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Schema"
          name="database"
          value={formData?.default?.database || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <SubmitButton label="TEST CONNECT" type="submit" sx={{ height: '50px', fontSize: '13px' }} />
      </Stack>
    </Stack>
  );
};

export default DatabaseForm;
