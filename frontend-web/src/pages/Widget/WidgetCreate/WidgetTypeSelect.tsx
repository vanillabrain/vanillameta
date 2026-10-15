import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from 'react-alert';
import LargeImgCardList from '@/components/LargeCardList';
import AiService from '@/api/aiService';
import { STATUS } from '@/constant';
import { SnackbarContext } from '@/contexts/AlertContext';
import { Button } from '@/components/ui/button';

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
    <div className="h-full flex-auto bg-muted px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-row justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecommendClick}
          disabled={recommending || !componentList.length}
          className="bg-background"
        >
          {recommending ? t('widgetCreate.aiRecommending') : t('widgetCreate.aiRecommend')}
        </Button>
      </div>
      <LargeImgCardList data={componentList} selectedType={widgetType} setSelectedType={setWidgetType} />
    </div>
  );
}

export default WidgetTypeSelect;
