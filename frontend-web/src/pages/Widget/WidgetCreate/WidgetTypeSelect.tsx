import React from 'react';
import { Box } from '@mui/material';
import LargeImgCardList from '@/components/LargeCardList';

function WidgetTypeSelect(props) {
  const { widgetType, setWidgetType, componentList } = props;

  return (
    <Box
      sx={{
        flex: '1 1 auto',
        height: '100%',
        px: '25px',
        pt: '22px',
        pb: '50px',
        backgroundColor: '#f5f6f8',
      }}
    >
      <LargeImgCardList data={componentList} selectedType={widgetType} setSelectedType={setWidgetType} />
    </Box>
  );
}

export default WidgetTypeSelect;
