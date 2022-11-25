import React from 'react';
import { Stack, TextField } from '@mui/material';
import SubmitButton from '@/components/button/SubmitButton';

const inputStyle = {
  width: '800px',
};

const SqliteDatabaseForm = props => {
  const { testConnect, formData, setFormData } = props;
  const handleSubmit = data => {
    data.preventDefault();
    const item = {
      name: data.target.name.value,
      filename: data.target.filename.value,
    };
    testConnect(item);
  };

  const handleNameChange = event => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
  };

  const handleChange = event => {
    setFormData(prevState => ({ ...prevState, sqlite: { ...prevState.sqlite, [event.target.name]: event.target.value } }));
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
          label="Filename"
          name="filename"
          value={formData?.sqlite?.filename || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <SubmitButton label="TEST CONNECT" type="submit" sx={{ height: '50px', fontSize: '13px' }} />
      </Stack>
    </Stack>
  );
};

export default SqliteDatabaseForm;
