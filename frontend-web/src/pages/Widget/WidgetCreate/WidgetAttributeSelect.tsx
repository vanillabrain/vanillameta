import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import WidgetSetting from '@/widget/wrapper/WidgetSetting';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import grid from '@/assets/images/grid.svg';
import { SnackbarContext } from '@/contexts/AlertContext';

interface WidgetAttributeSelectProps {
  widgetOption: any;
  saveWidgetInfo: (option: any, title: string) => Promise<boolean>;
  dataset?: any;
  dataSetId?: string;
  isModifyMode?: boolean;
  widgetTypeName?: string;
  widgetTypeDescription?: string;
  initialDraft?: { option: any; title: string };
  onDraftChange?: (draft: { option: any; title: string }) => void;
}

const cloneOption = option => {
  if (!option) return null;
  try {
    return typeof option === 'string' ? JSON.parse(option) : JSON.parse(JSON.stringify(option));
  } catch {
    return null;
  }
};

const WidgetAttributeSelect = (props: WidgetAttributeSelectProps) => {
  const { t } = useTranslation();
  const {
    widgetOption,
    saveWidgetInfo,
    dataset,
    isModifyMode = false,
    widgetTypeName,
    widgetTypeDescription,
    initialDraft,
    onDraftChange,
  } = props;

  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { fixLayout } = useContext(LayoutContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [option, setOption] = useState(() => cloneOption(initialDraft?.option ?? widgetOption?.option));
  const [data, setData] = useState(null);
  const [spec, setSpec] = useState(null);
  const [title, setTitle] = useState(initialDraft?.title ?? widgetOption?.title ?? '');

  useEffect(() => {
    fixLayout(true);
    return () => {
      fixLayout(false);
    };
  }, []);

  useEffect(() => {
    setData(null);
    setSpec(null);
    const source = isModifyMode ? widgetOption : dataset;
    const positiveId = id => Number.isFinite(Number(id)) && Number(id) > 0;
    const validSource =
      source?.datasetType === 'TABLE'
        ? positiveId(source.databaseId) && !!source.tableName
        : source?.datasetType === 'DATASET' && positiveId(isModifyMode ? source.datasetId : source.id);
    if (!validSource || (isModifyMode && !positiveId(widgetOption?.id))) return;
    const param = isModifyMode || source.datasetType === 'TABLE' ? { ...source } : { ...source, datasetId: source.id };
    let active = true;
    showLoading();
    DatabaseService.selectData(param)
      .then(response => {
        if (!active) return;
        if (response.data.status === STATUS.SUCCESS) {
          setData(response.data.data.datas);
          setSpec(response.data.data.fields);
        } else {
          alert.error(response.data.message || t('common.dbFetchFailed'));
        }
      })
      .catch(error => {
        if (active && error.code !== 'ERR_CANCELED' && error.name !== 'AbortError') {
          alert.error(error.response?.data?.message || t('common.dbFetchFailed'));
        }
      })
      .finally(() => {
        hideLoading();
      });
    return () => {
      active = false;
    };
  }, [dataset, widgetOption, isModifyMode]);

  useEffect(() => {
    setTitle(initialDraft?.title ?? widgetOption?.title ?? '');
    setOption(cloneOption(initialDraft?.option ?? widgetOption?.option));
  }, [widgetOption]);

  useEffect(() => {
    onDraftChange?.({ option, title });
  }, [option, title]);

  const handleSubmit = event => {
    event.preventDefault();
    if (!option) return;

    // confirm sample
    alert.success(t('widgetCreate.saveConfirm'), {
      title: t('widgetCreate.saveTitle'),
      closeCopy: t('data.cancel'),
      actions: [
        {
          copy: t('widget.save'),
          onClick: async () => {
            try {
              if ((await saveWidgetInfo(option, title)) === true) snackbar.success(t('widgetCreate.saved'));
            } catch (error) {
              alert.error(error.response?.data?.message || error.message || t('common.genericError'));
            }
          },
        },
      ],
    });
  };

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      sx={{
        width: '100%',
        minWidth: 0,
        height: {
          xs: isModifyMode ? 'calc(100dvh - 170px)' : 'calc(100dvh - 310px)',
          sm: isModifyMode ? 'calc(100dvh - 170px)' : 'calc(100dvh - 245px)',
          md: isModifyMode ? 'calc(100vh - 170px)' : 'calc(100vh - 245px)',
        },
        overflowX: 'hidden',
        overflowY: { xs: 'auto', md: 'hidden' },
        backgroundColor: '#f5f6f8',
        backgroundImage: `url(${grid})`,
        backgroundRepeat: 'repeat',
      }}
      onSubmit={handleSubmit}
      id="widgetAttribute"
      component="form"
    >
      {!option ? (
        <Typography sx={{ m: '54px auto' }}>
          {isModifyMode && widgetOption?.id ? t('share.widgetFetchFailed') : t('share.loading')}
        </Typography>
      ) : (
        <>
          <Box
            sx={{
              width: { xs: 'calc(100% - 32px)', md: '60%' },
              minWidth: 0,
              flexShrink: { xs: 0, md: 1 },
              height: { xs: '300px', sm: '50vw' },
              minHeight: '300px',
              maxHeight: { xs: 'none', md: '100%' },
              margin: { xs: '16px auto', md: '54px auto' },
              border: '1px solid #e2e2e2',
              borderRadius: '8px',
              boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
              backgroundColor: '#fff',
              overflow: 'hidden',
            }}
          >
            <WidgetViewer title={title} widgetType={widgetOption.componentType} widgetOption={option} dataSet={data} />
          </Box>
          <WidgetSetting
            widgetTypeName={widgetTypeName}
            widgetTypeDescription={widgetTypeDescription}
            title={title}
            setTitle={setTitle}
            widgetType={widgetOption.componentType}
            widgetOption={option}
            setWidgetOption={setOption}
            dataSet={data}
            spec={spec}
          />
        </>
      )}
    </Stack>
  );
};

export default WidgetAttributeSelect;
