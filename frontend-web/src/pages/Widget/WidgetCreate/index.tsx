import React, { useEffect, useState } from 'react';
import { Box, Stack, Step, StepLabel, Stepper } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';
import PageContainer from '@/components/PageContainer';
import ConfirmCancelButton, { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';
import componentService from '@/api/componentService';
import widgetService from '@/api/widgetService';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

function WidgetCreate() {
  const [activeStep, setActiveStep] = useState(0);

  const [componentList, setComponentList] = useState([]); // step 1
  const [datasetId, setDatasetId] = useState(null); // step 1
  const [componentInfo, setComponentInfo] = useState(null); // step 2

  // 개발 편의상 임시로 적용
  useEffect(() => {
    setDatasetId(688279);
    setActiveStep(1);
    getComponentList();
  }, []);

  const [isNextButtonDisabled, setIsNextButtonDisabled] = useState(true);

  useEffect(() => {
    // console.log('componentInfo', componentInfo);
    if (activeStep === 0 && !!datasetId) {
      setIsNextButtonDisabled(false);
      return;
    }

    if (activeStep === 1 && !!componentInfo) {
      setIsNextButtonDisabled(false);
      return;
    }

    setIsNextButtonDisabled(true);
  }, [activeStep, datasetId, componentInfo]);

  const getComponentList = () => {
    componentService.selectComponentList().then(res => {
      // console.log(res.data);
      setComponentList(res.data);
    });
  };

  const saveWidgetInfo = option => {
    const param = {
      title: option.title,
      description: option.title,
      databaseId: 1,
      componentId: componentInfo.id,
      // 'DATASET', 'WIDGET_VIEW'
      datasetType: 'DATASET',
      datasetId: '0001',
      tableName: '',
      option: option,
    };
    console.log(option);
    widgetService.createWidget(param).then(response => console.log(response));
  };

  const handleNext = (event, item) => {
    console.log('component : ', item);
    event.preventDefault();
    if (activeStep === steps.length - 1) {
      return;
    }
    if (activeStep === 0) {
      setDatasetId(item);
    }
    if (activeStep === 1) {
      setComponentInfo(item);
    }
    setActiveStep(prevState => prevState + 1);
  };

  const handleBack = () => {
    if (activeStep === 0) {
      return;
    }

    if (activeStep === 1) {
      setDatasetId(null);
    }

    if (activeStep === 2) {
      setComponentInfo(null);
    }

    setActiveStep(prevState => prevState - 1);
  };

  return (
    <PageContainer>
      <PageTitleBox
        title={title}
        button={
          <Stack>
            <ConfirmCancelButton
              cancelLabel="이전"
              cancelProps={{
                onClick: handleBack,
                disabled: activeStep === 0,
              }}
              secondButton={
                <React.Fragment>
                  {activeStep !== 2 ? (
                    <ConfirmButton
                      confirmLabel="다음"
                      confirmProps={{
                        type: 'button',
                        onClick: handleNext,
                        disabled: isNextButtonDisabled,
                      }}
                    />
                  ) : (
                    <ConfirmButton
                      confirmLabel="저장"
                      confirmProps={{
                        form: 'widgetAttribute',
                        type: 'submit',
                        variant: 'contained',
                      }}
                    />
                  )}
                </React.Fragment>
              }
            />
          </Stack>
        }
      >
        <Box>
          <Stepper
            activeStep={activeStep}
            sx={{
              width: { xs: '100%', sm: '70%' },
              m: 'auto',
              mt: 8,
              mb: 6,
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

        {activeStep === 0 ? (
          <WidgetDataSelect setDataSet={setDatasetId} handleNext={handleNext} />
        ) : activeStep === 1 ? (
          <WidgetTypeSelect
            componentInfo={componentInfo}
            setWidgetType={setComponentInfo}
            componentList={componentList}
            handleNext={handleNext}
          />
        ) : (
          <WidgetAttributeSelect dataSetId={datasetId} componentInfo={componentInfo} saveWidgetInfo={saveWidgetInfo} />
        )}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
