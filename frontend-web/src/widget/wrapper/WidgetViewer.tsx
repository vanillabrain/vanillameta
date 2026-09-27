import React, { useContext, useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { LoadingContext } from '@/contexts/LoadingContext';
import { renderWidgetViewer } from '@/widget/viewerRegistry';

export const WidgetEmpty = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        borderRadius: '6px',
      }}
    >
      <Typography
        sx={{
          margin: '200px auto',
          fontSize: '14px',
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: '1.6',
          color: '#333',
        }}
      >
        위젯 조회에 실패했습니다.
        <br />
        다시 시도해 주세요.
      </Typography>
    </Box>
  );
};

const WidgetViewer = props => {
  const { title, widgetType, widgetOption, dataSet, isInvalidData, size } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [module, setModule] = useState(null);

  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderWidget();
  }, [widgetType, widgetOption, dataSet]);

  const renderWidget = () => {
    showLoading();
    setModule(renderWidgetViewer(widgetType, { option: widgetOption, dataSet }));
    hideLoading();
  };

  const renderTitle = () => {
    if (widgetOption?.header?.titleHidden) {
      return '';
    } else {
      return title;
    }
  };

  return (
    <Stack
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          width: '100%',
          height: '50px',
          paddingLeft: '20px',
          paddingTop: '18px',
          paddingBottom: '12px',
        }}
      >
        <Typography
          variant="subtitle1"
          component="span"
          sx={{
            overflow: 'hidden',
            width: 'calc(100% - 40px)',
            fontSize: '16px',
            fontWeight: '600',
            fontStretch: 'normal',
            fontStyle: 'normal',
            lineHeight: '1.25',
            letterSpacing: '-0.16px',
            textAlign: 'left',
            color: '#333',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {renderTitle()}
        </Typography>
      </Stack>

      <Stack
        sx={{
          width: '100%',
          height: 'calc(100% - 48px)',
          pt: '10px',
          pb: { xs: '25px', sm: '48px' },
          px: { xs: '10px', sm: '40px' },
          overflowY: 'auto',
        }}
      >
        <Stack
          sx={{
            position: 'relative',
            width: '100%',
            minWidth: { xs: `calc(${size} * 80px)`, sm: 0 },
            height: '100%',
          }}
        >
          {isInvalidData ? <WidgetEmpty /> : module}
        </Stack>
      </Stack>
    </Stack>
  );
};

export default WidgetViewer;
