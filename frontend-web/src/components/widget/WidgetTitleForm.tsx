import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';

function WidgetTitleForm(props) {
  const { t } = useTranslation();
  const { value, onChange, className, ...rest } = props;

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
      value={value}
      onChange={onChange}
      className={cn('mt-10 md:mt-0', className)}
      {...rest}
    />
  );
}

export default WidgetTitleForm;
