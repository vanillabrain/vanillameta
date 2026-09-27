import React, { useContext, useEffect, useState } from 'react';
import { Divider, List, Stack, styled, Typography } from '@mui/material';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import { LoadingContext } from '@/contexts/LoadingContext';
import { renderWidgetSetting } from '@/widget/settingRegistry';

const StyledList = styled(List)({
  padding: 0,

  '& .MuiListItemText-root': {
    width: '100%',
  },
  '& .MuiListItemText-primary': {
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  '& .MuiListItem-root': {
    display: 'flex',
    flexDirection: ' column',
    rowGap: 8,
    width: '100%',
    padding: '30px 0 30px',
    fontSize: '14px',

    hr: {
      height: '4px',
    },
  },
});

const WidgetSetting = props => {
  const {
    title,
    setTitle,
    widgetOption,
    setWidgetOption,
    widgetType,
    widgetTypeName,
    widgetTypeDescription,
    dataSet,
    spec,
  } = props;

  const [module, setModule] = useState(null);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderSetting();
  }, [widgetType, widgetOption, spec, dataSet]);

  const renderSetting = () => {
    showLoading();
    setModule(
      renderWidgetSetting(widgetType, {
        option: widgetOption,
        setOption: setWidgetOption,
        spec,
        dataSet,
      }),
    );
    hideLoading();
  };

  return (
    <Stack
      justifyContent="space-between"
      sx={{
        width: '40%',
        maxWidth: '440px',
        minWidth: '340px',
        height: '100%',
        px: '24px',
        py: '30px',
        overflowY: 'auto !important',
        backgroundColor: '#fff',
      }}
    >
      <Stack>
        <Typography
          component="span"
          sx={{
            fontWeight: 'bold',
            color: '#767676',
            mb: '16px',
          }}
        >
          {widgetTypeName}
          <Typography component="span">{`(${widgetTypeDescription})`}</Typography>
        </Typography>
        <WidgetTitleForm value={title} onChange={event => setTitle(event.target.value)} />
        <Divider sx={{ mt: '30px' }} />

        <StyledList>{module}</StyledList>
      </Stack>
      <ConfirmButton
        sx={{ minHeight: '44px', mt: '30px', fontWeight: 'bold', backgroundColor: '#043f84' }}
        confirmLabel="저장"
        confirmProps={{
          form: 'widgetAttribute',
          type: 'submit',
          variant: 'contained',
        }}
      />
    </Stack>
  );
};

export default WidgetSetting;
