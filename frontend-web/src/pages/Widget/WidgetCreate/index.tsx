import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAlert } from 'react-alert';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';
import componentService from '@/api/componentService';
import widgetService from '@/api/widgetService';
import { LoadingContext } from '@/contexts/LoadingContext';
import LeftArrow from '@/assets/images/icon/angle-left.svg?react';
import { STATUS } from '@/constant';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WidgetCreate = () => {
  const { t } = useTranslation();
  const steps = t('widget.steps', { returnObjects: true }) as string[];
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const [componentList, setComponentList] = useState([]); // step 1
  const [dataset, setDataset] = useState(null); // step 1
  const [widgetOption, setWidgetOption] = useState(null); // step 2
  const [draft, setDraft] = useState(null);
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);

  useEffect(() => {
    getComponentList();
  }, []);

  const [isNextButtonDisabled, setIsNextButtonDisabled] = useState(true);

  useEffect(() => {
    console.log('dataset', dataset);
    if (activeStep === 0 && !!dataset) {
      setIsNextButtonDisabled(false);
      return;
    }

    if (activeStep === 1 && !!widgetOption) {
      setIsNextButtonDisabled(false);
      return;
    }

    setIsNextButtonDisabled(true);
  }, [activeStep, dataset, widgetOption]);

  const getComponentList = () => {
    showLoading();
    componentService
      .selectComponentList()
      .then(res => {
        setComponentList(res.data);
      })
      .catch(error => {
        alert.error(error.response?.data?.message || error.message || t('common.genericError'));
      })
      .finally(() => {
        hideLoading();
      });
  };

  const saveWidgetInfo = async (option, title): Promise<boolean> => {
    const param = {
      title: title,
      description: widgetOption.description,
      databaseId: dataset.databaseId,
      componentId: widgetOption.id,
      datasetType: dataset.datasetType,
      tableName: undefined,
      datasetId: undefined,
      option: option,
    };
    if (param.datasetType === 'TABLE') {
      param.tableName = dataset.tableName;
    } else {
      param.datasetId = dataset.id;
    }
    console.log('위젯 생성', param);
    showLoading();
    try {
      const response = await widgetService.createWidget(param);
      if (response.data.status === STATUS.SUCCESS) {
        navigate('/widget');
        return true;
      }
      alert.error(response.data.message || t('common.genericError'));
      return false;
    } catch (error) {
      alert.error(error.response?.data?.message || error.message || t('common.genericError'));
      return false;
    } finally {
      hideLoading();
    }
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      return;
    }
    setActiveStep(prevState => prevState + 1);
  };

  const handleBack = () => {
    if (activeStep === 0) {
      return;
    }

    setActiveStep(prevState => prevState - 1);
  };

  const handleDatasetChange = selected => {
    const sameSource =
      dataset?.datasetType === selected?.datasetType &&
      dataset?.databaseId === selected?.databaseId &&
      (selected?.datasetType === 'TABLE' ? dataset?.tableName === selected?.tableName : dataset?.id === selected?.id);
    if (sameSource) return;
    setDataset(selected);
    setWidgetOption(null);
    setDraft(null);
  };

  const handleWidgetTypeChange = selected => {
    if (widgetOption?.id === selected?.id) return;
    setWidgetOption(selected);
    setDraft(null);
  };

  return (
    <PageTitleBox
      fixed
      title={t('widget.createTitle')}
      upperTitle={t('widget.title')}
      upperTitleLink="/widget"
      className="h-full w-full p-0"
      button={
        <div className="flex flex-row gap-2.5">
          <Button variant="outline" onClick={handleBack} disabled={activeStep === 0} className="gap-1.5 text-primary">
            <LeftArrow aria-hidden="true" className="size-3.5 p-px" />
            {t('widget.prev')}
          </Button>

          {activeStep !== 2 ? (
            <Button type="button" onClick={handleNext} disabled={isNextButtonDisabled} className="gap-1.5 bg-primary">
              {t('widget.next')}
              <LeftArrow aria-hidden="true" className="size-3.5 rotate-180 p-px" />
            </Button>
          ) : (
            ' '
          )}
        </div>
      }
    >
      <div className="z-30 mt-24 w-full shrink-0 border-b border-border bg-background sm:mt-14 md:fixed">
        <ol className="mx-auto flex min-h-[72px] w-full min-w-0 max-w-[564px] items-center px-3 py-3 sm:py-0 md:w-1/2 md:min-w-[450px] md:px-0">
          {steps.map((label, index) => (
            <li key={label} className="flex min-w-0 flex-1 flex-col items-center md:flex-row md:gap-2">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  index <= activeStep ? 'bg-primary text-white' : 'bg-border text-muted-foreground',
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  'min-w-0 text-center text-sm break-words',
                  index <= activeStep ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  'md:pr-2 md:text-left',
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex min-w-0 flex-auto md:mt-[129px]">
        <div className={cn('flex-auto', activeStep === 0 ? 'flex' : 'hidden')}>
          <WidgetDataSelect setDataSet={handleDatasetChange} />
        </div>
        {activeStep === 1 ? (
          <WidgetTypeSelect
            widgetType={widgetOption}
            setWidgetType={handleWidgetTypeChange}
            componentList={componentList}
            dataset={dataset}
          />
        ) : activeStep === 2 ? (
          <WidgetAttributeSelect
            dataset={dataset}
            widgetOption={widgetOption}
            saveWidgetInfo={saveWidgetInfo}
            initialDraft={draft}
            onDraftChange={setDraft}
            widgetTypeName={widgetOption.title}
            widgetTypeDescription={widgetOption.description}
          />
        ) : null}
      </div>
    </PageTitleBox>
  );
};

export default WidgetCreate;
