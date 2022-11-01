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
      databaseName: data.target.databaseName.value,
      filename: data.target.filename.value,
    };
    testConnect(item);
  };

  const handleChange = event => {
    setFormData(prevState => ({ ...prevState, sqlite3: { ...prevState.sqlite3, [event.target.name]: event.target.value } }));
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
          label="Filename"
          name="filename"
          value={formData?.filename || ''}
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

export default SqliteDatabaseForm;
