import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@/components/ui/text-field';
import SubmitButton from '@/components/button/SubmitButton';

const BigQueryDatabaseForm = props => {
  const { t } = useTranslation();
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
    <form
      className="mx-auto w-full max-w-[560px] rounded-lg border border-border bg-background p-5 sm:p-6"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('settings.name')}
          name="name"
          value={formData?.name || ''}
          required
          onChange={handleNameChange}
        />
        <TextField
          label="Project Id"
          name="projectId"
          value={formData?.bigquery?.projectId || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="File Name"
          name="keyFilename"
          value={formData?.bigquery?.keyFilename || ''}
          required
          onChange={handleChange}
        />
        <TextField label="Schema" name="schema" value={formData?.bigquery?.schema || ''} required onChange={handleChange} />
        <SubmitButton label="TEST CONNECT" type="submit" />
      </div>
    </form>
  );
};

export default BigQueryDatabaseForm;
