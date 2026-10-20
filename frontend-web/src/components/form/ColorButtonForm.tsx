import React from 'react';
import { useTranslation } from 'react-i18next';
import ColorPickerForm from './ColorPickerForm';

function ColorButtonForm({ option, setOption, index }) {
  const { t } = useTranslation();
  return (
    <ColorPickerForm
      label={`${t('settings.field')} ${index + 1} ${t('common.colorPicker')}`}
      color={option.series[index].color || '#eee'}
      onChange={event =>
        setOption(previous => ({
          ...previous,
          series: previous.series.map((series, position) =>
            position === index ? { ...series, color: event.target.value } : series,
          ),
        }))
      }
    />
  );
}

export default ColorButtonForm;
