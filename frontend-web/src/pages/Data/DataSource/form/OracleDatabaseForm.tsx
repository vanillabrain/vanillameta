import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@/components/ui/text-field';
import SubmitButton from '@/components/button/SubmitButton';

const OracleDatabaseForm = props => {
  const { t } = useTranslation();
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
        <TextField label="Host" name="host" value={formData?.oracle?.host || ''} required onChange={handleChange} />
        <TextField
          label="Port"
          name="port"
          type="number"
          value={formData?.oracle?.port || ''}
          required
          onChange={handleChange}
        />
        <TextField label="User" name="user" value={formData?.oracle?.user || ''} required onChange={handleChange} />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={formData?.oracle?.password || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="Database"
          name="database"
          value={formData?.oracle?.database || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="InstanceName"
          name="instanceName"
          value={formData?.oracle?.instanceName || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="FetchAsString"
          name="fetchAsString"
          value={formData?.oracle?.fetchAsString || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="RequestTimeout"
          name="requestTimeout"
          value={formData?.oracle?.requestTimeout || ''}
          required
          onChange={handleChange}
        />
        <SubmitButton label="TEST CONNECT" type="submit" />
      </div>
    </form>
  );
};

export default OracleDatabaseForm;
