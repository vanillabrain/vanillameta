import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@mui/material';

function WidgetTitleForm(props) {
  const { t } = useTranslation();
  const { value, onChange, ...rest } = props;

  const validateTitle = title => {
    if (title === undefined) {
      return;
    }
    return title.trim() === '' || title.length > 20;
  };

  return (
    <TextField
      id="title"
      name="title"
      label={t('common.widgetName')}
      placeholder={t('common.widgetNameGuide')}
      required={validateTitle(value)}
      fullWidth
      value={value}
      onChange={onChange}
      sx={{ mt: { xs: 5, md: 0 } }}
      {...rest}
    />
  );
}

export default WidgetTitleForm;
