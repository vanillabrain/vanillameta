import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Stack } from '@mui/material';
import { useAlert } from 'react-alert';
import LargeImgCardList from '@/components/LargeCardList';
import AiService from '@/api/aiService';
import { STATUS } from '@/constant';
import { SnackbarContext } from '@/contexts/AlertContext';

function WidgetTypeSelect(props) {
  const { t } = useTranslation();
  const { widgetType, setWidgetType, componentList, dataset } = props;
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const [recommending, setRecommending] = useState(false);

  const handleRecommendClick = () => {
    if (!dataset) return;
    setRecommending(true);
    AiService.recommendChart({
      databaseId: dataset.databaseId,
      datasetType: dataset.datasetType,
      datasetId: dataset.datasetType === 'DATASET' ? dataset.id : undefined,
      tableName: dataset.datasetType === 'TABLE' ? dataset.tableName : undefined,
    })
      .then(response => {
        if (response.data.status === STATUS.SUCCESS) {
          const { component, reason } = response.data.data;
          const matched = componentList.find(
            item => item.componentType === component.type || item.type === component.type || item.id === component.id,
          );
          if (matched) {
            setWidgetType(matched);
            snackbar.success(
              t('widgetCreate.aiRecommended', {
                title: matched.title || component.title,
                reason: reason ? ` — ${reason}` : '',
              }),
            );
          } else {
            alert.error(t('widgetCreate.aiNotFound'));
          }
        } else {
          alert.error(response.data.message || t('widgetCreate.aiFailed'));
        }
      })
      .catch(error => {
        alert.error(error.message);
      })
      .finally(() => {
        setRecommending(false);
      });
  };

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
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: '12px' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleRecommendClick}
          disabled={recommending || !componentList.length}
          sx={{ backgroundColor: '#fff' }}
        >
          {recommending ? t('widgetCreate.aiRecommending') : t('widgetCreate.aiRecommend')}
        </Button>
      </Stack>
      <LargeImgCardList data={componentList} selectedType={widgetType} setSelectedType={setWidgetType} />
    </Box>
  );
}

export default WidgetTypeSelect;
