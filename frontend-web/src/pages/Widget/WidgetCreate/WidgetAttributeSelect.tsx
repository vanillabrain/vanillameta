import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from 'react-alert';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import WidgetSetting from '@/widget/wrapper/WidgetSetting';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import grid from '@/assets/images/grid.svg';
import { SnackbarContext } from '@/contexts/AlertContext';
import { cn } from '@/lib/utils';

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
    <form
      id="widgetAttribute"
      onSubmit={handleSubmit}
      className={cn(
        'flex w-full min-w-0 flex-col justify-between overflow-x-hidden bg-muted md:flex-row md:overflow-y-hidden',
        isModifyMode
          ? 'h-[calc(100dvh-170px)] md:h-[calc(100vh-170px)]'
          : 'h-[calc(100dvh-310px)] sm:h-[calc(100dvh-245px)] md:h-[calc(100vh-245px)]',
      )}
      style={{ backgroundImage: `url(${grid})`, backgroundRepeat: 'repeat' }}
    >
      {!option ? (
        <p className="mx-auto my-[54px]">
          {isModifyMode && widgetOption?.id ? t('share.widgetFetchFailed') : t('share.loading')}
        </p>
      ) : (
        <>
          <div className="mx-auto my-4 h-[300px] max-h-none min-h-[300px] w-[calc(100%-32px)] shrink-0 overflow-hidden rounded-lg border border-border bg-background shadow-sm sm:h-[50vw] md:my-[54px] md:h-full md:max-h-full md:w-3/5 md:shrink">
            <WidgetViewer title={title} widgetType={widgetOption.componentType} widgetOption={option} dataSet={data} />
          </div>
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
    </form>
  );
};

export default WidgetAttributeSelect;
