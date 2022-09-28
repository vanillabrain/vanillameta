import React, { useState, useEffect } from 'react';
import { Box, Stack, Step, StepLabel, Stepper } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';
import PageContainer from '@/components/PageContainer';
import ConfirmCancelButton, { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';
import { WIDGET_TYPE } from '@/constant';
import { get } from '@/helpers/apiHelper';
import componentService from '@/api/componentService';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

function WidgetCreate(props) {
  const [activeStep, setActiveStep] = useState(0);

  const [componentList, setComponentList] = useState([]); // step 1
  const [dataSet, setDataSet] = useState(null); // step 1
  const [widgetType, setWidgetType] = useState(null); // step 2

  // 개발 편의상 임시로 적용
  useEffect(() => {
    setDataSet(688279);
    setWidgetType(WIDGET_TYPE.CHART_LINE);
    setActiveStep(1);
    getComponentList();
  }, []);

  const [isNextButtonDisabled, setIsNextButtonDisabled] = useState(true);

  useEffect(() => {
    if (activeStep === 0 && !!dataSet) {
      setIsNextButtonDisabled(false);
      return;
    }

    if (activeStep === 1 && !!widgetType) {
      setIsNextButtonDisabled(false);
      return;
    }

    setIsNextButtonDisabled(true);
  }, [activeStep, dataSet, widgetType]);

  const getComponentList = () => {
    componentService.selectComponentList().then(res => {
      console.log(res);
      setComponentList(res.data);
    });
  };

  const handleNext = event => {
    event.preventDefault();
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
      setDataSet(null);
    }

    if (activeStep === 2) {
      setWidgetType(null);
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
          <WidgetDataSelect setDataSet={setDataSet} />
        ) : activeStep === 1 ? (
          <WidgetTypeSelect widgetType={widgetType} setWidgetType={setWidgetType} componentList={componentList} />
        ) : (
          <WidgetAttributeSelect dataSetId={dataSet} componentType={widgetType} com />
        )}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
