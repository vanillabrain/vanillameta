import React from 'react';
import { Stack, TextField } from '@mui/material';
import SubmitButton from '@/components/button/SubmitButton';

const inputStyle = {
  width: '800px',
};

const BigQueryDatabaseForm = props => {
  const { testConnect, formData, setFormData } = props;
  const handleSubmit = data => {
    data.preventDefault();
    const item = {
      name: data.target.name.value,
      projectId: data.target.projectId.value,
      keyFilename: data.target.keyFilename.value,
      schema: data.target.schema.value,
    };
    testConnect(item);
  };

  const handleNameChange = event => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
  };

  const handleChange = event => {
    setFormData(prevState => ({
      ...prevState,
      bigquery: { ...prevState.bigquery, [event.target.name]: event.target.value },
    }));
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
          label="Project Id"
          name="projectId"
          value={formData?.bigquery?.projectId || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="File Name"
          name="keyFilename"
          value={formData?.bigquery?.keyFilename || ''}
          required
          fullWidth
          sx={inputStyle}
          onChange={handleChange}
        />
        <TextField
          label="Schema"
          name="schema"
          value={formData?.bigquery?.schema || ''}
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

export default BigQueryDatabaseForm;
