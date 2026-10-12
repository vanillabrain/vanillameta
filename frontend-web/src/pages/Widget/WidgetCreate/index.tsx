import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Stack, Step, StepLabel, Stepper, SvgIcon } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';
import componentService from '@/api/componentService';
import widgetService from '@/api/widgetService';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingContext } from '@/contexts/LoadingContext';
import LeftArrow from '@/assets/images/icon/angle-left.svg?react';
import { useAlert } from 'react-alert';
import { STATUS } from '@/constant';

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
      sx={{ paddingLeft: 0, paddingRight: 0, width: '100%', height: '100%' }}
      button={
        <Stack direction="row" gap="10px">
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={activeStep === 0}
            startIcon={
              <SvgIcon
                component={LeftArrow}
                sx={{
                  width: '14px',
                  height: '14px',
                  padding: '1px',
                }}
                inheritViewBox
              />
            }
            sx={{
              color: '#043f84',
              '&.Mui-disabled &.MuiButton-startIcon': {
                color: '#fff',
              },
            }}
          >
            {t('widget.prev')}
          </Button>

          {activeStep !== 2 ? (
            <Button
              variant="contained"
              type="button"
              onClick={handleNext}
              disabled={isNextButtonDisabled}
              endIcon={
                <SvgIcon
                  component={LeftArrow}
                  sx={{ width: '14px', height: '14px', transform: 'rotate(180deg)', padding: '1px' }}
                  inheritViewBox
                />
              }
              sx={{ backgroundColor: '#043f84' }}
            >
              {t('widget.next')}
            </Button>
          ) : (
            ' '
          )}
        </Stack>
      }
    >
      <Box
        sx={{
          position: { xs: 'static', md: 'fixed' },
          zIndex: 1000,
          width: '100%',
          mt: { xs: '96px', sm: '56px' },
          flexShrink: 0,
          borderBottom: '1px solid #e3e7ea',
          backgroundColor: '#fff',
        }}
      >
        <Stepper
          activeStep={activeStep}
          sx={{
            width: { xs: '100%', md: '50%' },
            minWidth: { xs: 0, md: '450px' },
            maxWidth: '564px',
            height: { xs: 'auto', sm: '72px' },
            minHeight: '72px',
            px: { xs: '12px', md: 0 },
            py: { xs: '12px', sm: 0 },
            m: 'auto',
            '& .MuiStep-root': { minWidth: { xs: 0, md: 'auto' } },
            '& .MuiStepLabel-root': { flexDirection: { xs: 'column', md: 'row' } },
            '& .MuiStepLabel-iconContainer': { pr: { xs: 0, md: '8px' } },
            '& .MuiStepLabel-labelContainer': {
              minWidth: 0,
              textAlign: { xs: 'center', md: 'left' },
              overflowWrap: 'anywhere',
            },
          }}
        >
          {steps.map(label => {
            const stepProps: { completed?: boolean } = {};
            const labelProps: {
              optional?: React.ReactNode;
            } = {};
            return (
              <Step key={label} {...stepProps}>
                <StepLabel {...labelProps}>{label}</StepLabel>
              </Step>
            );
          })}
        </Stepper>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flex: '1 1 auto',
          mt: { xs: 0, md: '129px' },
          minWidth: 0,
        }}
      >
        <Box sx={{ display: activeStep === 0 ? 'flex' : 'none', flex: '1 1 auto' }}>
          <WidgetDataSelect setDataSet={handleDatasetChange} />
        </Box>
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
      </Box>
    </PageTitleBox>
  );
};

export default WidgetCreate;
