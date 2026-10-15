import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@/components/ui/text-field';
import SubmitButton from '@/components/button/SubmitButton';

const SnowflakeDatabaseForm = props => {
  const { t } = useTranslation();
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
    <form className="mx-auto mt-3 w-full max-w-[800px]" onSubmit={handleSubmit}>
      <div className="flex flex-col justify-between gap-5">
        <TextField
          label={t('settings.name')}
          name="name"
          value={formData?.name || ''}
          required
          onChange={handleNameChange}
        />
        <TextField
          label="Account"
          name="account"
          value={formData?.snowflake?.account || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="Username"
          name="username"
          value={formData?.snowflake?.username || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={formData?.snowflake?.password || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="Database"
          name="database"
          value={formData?.snowflake?.database || ''}
          required
          onChange={handleChange}
        />{' '}
        <TextField
          label="Application"
          name="application"
          value={formData?.snowflake?.application || ''}
          required
          onChange={handleChange}
        />
        <TextField label="Schema" name="schema" value={formData?.snowflake?.schema || ''} required onChange={handleChange} />
        <TextField
          label="Warehouse"
          name="warehouse"
          value={formData?.snowflake?.warehouse || ''}
          required
          onChange={handleChange}
        />
        <SubmitButton label="TEST CONNECT" type="submit" className="h-[50px] text-[13px]" />
      </div>
    </form>
  );
};

export default SnowflakeDatabaseForm;
