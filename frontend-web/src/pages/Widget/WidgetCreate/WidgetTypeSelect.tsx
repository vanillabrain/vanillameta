import React from 'react';
import { Box } from '@mui/material';
import ImgCardList from '@/components/ImgCardList';

function WidgetTypeSelect(props) {
  const { widgetType, setWidgetType, componentList } = props;

  return (
    <Box
      sx={{
        height: '100%',
        px: '25px',
        py: '60px',
        backgroundColor: '#f5f6f8',
      }}
    >
      <ImgCardList data={componentList} selectedType={widgetType} setSelectedType={setWidgetType} />
    </Box>
  );
}

export default WidgetTypeSelect;
