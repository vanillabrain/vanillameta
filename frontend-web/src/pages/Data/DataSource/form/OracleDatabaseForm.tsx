import React from 'react';
import { Stack, TextField } from '@mui/material';
import SubmitButton from '@/components/button/SubmitButton';

const OracleDatabaseForm = props => {
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
      instanceName: data.target.instanceName.value,
      fetchAsString: data.target.fetchAsString.value,
      requestTimeout: data.target.requestTimeout.value,
    };
    testConnect(item);
  };

  const handleNameChange = event => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
  };

  const handleChange = event => {
    setFormData(prevState => ({ ...prevState, oracle: { ...prevState.oracle, [event.target.name]: event.target.value } }));
  };

  return (
    <Stack component="form" sx={{ maxWidth: '800px', width: '100%', mx: 'auto', mt: 3 }} onSubmit={handleSubmit}>
      <Stack sx={{ display: 'flex', justifyContent: 'space-between' }} spacing="20px">
        <TextField label="이름" name="name" value={formData?.name || ''} required fullWidth onChange={handleNameChange} />
        <TextField
          label="Host"
          name="host"
          value={formData?.oracle?.host || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Port"
          name="port"
          type="number"
          value={formData?.oracle?.port || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="User"
          name="user"
          value={formData?.oracle?.user || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Password"
          name="password"
          value={formData?.oracle?.password || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="Database"
          name="database"
          value={formData?.oracle?.database || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="InstanceName"
          name="instanceName"
          value={formData?.oracle?.instanceName || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="FetchAsString"
          name="fetchAsString"
          value={formData?.oracle?.fetchAsString || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <TextField
          label="RequestTimeout"
          name="requestTimeout"
          value={formData?.oracle?.requestTimeout || ''}
          required
          fullWidth
          onChange={handleChange}
        />
        <SubmitButton label="TEST CONNECT" type="submit" sx={{ height: '50px', fontSize: '13px' }} />
      </Stack>
    </Stack>
  );
};

export default OracleDatabaseForm;
