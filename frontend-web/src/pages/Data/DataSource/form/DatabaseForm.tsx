import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@/components/ui/text-field';
import SubmitButton from '@/components/button/SubmitButton';

const DatabaseForm = props => {
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
    <form className="mx-auto mt-3 w-full max-w-[800px]" onSubmit={handleSubmit}>
      <div className="flex flex-col justify-between gap-5">
        <TextField
          label={t('settings.name')}
          name="name"
          value={formData?.name || ''}
          required
          onChange={handleNameChange}
        />
        <TextField label="Host" name="host" value={formData?.default?.host || ''} required onChange={handleChange} />
        <TextField
          label="Port"
          name="port"
          type="number"
          value={formData?.default?.port || ''}
          required
          onChange={handleChange}
        />
        <TextField label="User" name="user" value={formData?.default?.user || ''} required onChange={handleChange} />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={formData?.default?.password || ''}
          required
          onChange={handleChange}
        />
        <TextField
          label="Schema"
          name="database"
          value={formData?.default?.database || ''}
          required
          onChange={handleChange}
        />
        <SubmitButton label="TEST CONNECT" type="submit" className="h-[50px] text-[13px]" />
      </div>
    </form>
  );
};

export default DatabaseForm;
