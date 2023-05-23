import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Stack, Step, StepLabel, Stepper, SvgIcon } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';
import componentService from '@/api/componentService';
import widgetService from '@/api/widgetService';
import { useNavigate } from 'react-router-dom';
import { LoadingContext } from '@/contexts/LoadingContext';
import { ReactComponent as LeftArrow } from '@/assets/images/icon/angle-left.svg';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

const WidgetCreate = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const [componentList, setComponentList] = useState([]); // step 1
  const [dataset, setDataset] = useState(null); // step 1
  const [widgetOption, setWidgetOption] = useState(null); // step 2
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
      .finally(() => {
        hideLoading();
      });
  };

  const saveWidgetInfo = (option, title) => {
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
    widgetService
      .createWidget(param)
      .then(response => {
        if (response.data.status === 'SUCCESS') {
          navigate('/widget');
        }
      })
      .finally(() => {
        hideLoading();
      });
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

    if (activeStep === 1) {
      setDataset(null);
    }

    if (activeStep === 2) {
      setWidgetOption(null);
    }

    setActiveStep(prevState => prevState - 1);
  };

  return (
    <PageTitleBox
      fixed
      title={title}
      upperTitle="위젯"
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
            이전
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
              다음
            </Button>
          ) : (
            ' '
          )}
        </Stack>
      }
    >
      <Box
        sx={{
          position: 'fixed',
          zIndex: 1000,
          width: '100%',
          mt: '56px',
          borderBottom: '1px solid #e3e7ea',
          backgroundColor: '#fff',
        }}
      >
        <Stepper
          activeStep={activeStep}
          sx={{
            width: '50%',
            minWidth: '450px',
            maxWidth: '564px',
            height: '72px',
            m: 'auto',
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
          mt: '129px',
        }}
      >
        {activeStep === 0 ? (
          <WidgetDataSelect setDataSet={setDataset} />
        ) : activeStep === 1 ? (
          <WidgetTypeSelect widgetType={widgetOption} setWidgetType={setWidgetOption} componentList={componentList} />
        ) : (
          <WidgetAttributeSelect
            dataset={dataset}
            widgetOption={widgetOption}
            saveWidgetInfo={saveWidgetInfo}
            widgetTypeName={widgetOption.title}
            widgetTypeDescription={widgetOption.description}
          />
        )}
      </Box>
    </PageTitleBox>
  );
};

export default WidgetCreate;
