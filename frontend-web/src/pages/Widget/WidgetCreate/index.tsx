import React, { useState, useEffect } from 'react';
import { Box, Stack, Step, StepLabel, Stepper } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';
import PageContainer from '@/components/PageContainer';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import TitleBox from '@/components/TitleBox';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';
import { WIDGET_TYPE } from '@/constant';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

function WidgetCreate(props) {
  const [activeStep, setActiveStep] = useState(0);

  const [dataSet, setDataSet] = useState(null); // step 1
  const [widgetType, setWidgetType] = useState(null); // step 2

  // 개발 편의상 임시로 적용
  useEffect(() => {
    setDataSet(688279);
    setWidgetType(WIDGET_TYPE.BOARD_TABLE);
    setActiveStep(2);
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

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prevState => prevState + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prevState => prevState - 1);
    }
  };

  return (
    <PageContainer>
      <PageTitleBox
        title={title}
        button={
          <Stack>
            <ConfirmCancelButton
              confirmLabel={activeStep !== steps.length - 1 ? '다음' : '저장'}
              cancelLabel="이전"
              confirmProps={
                activeStep !== steps.length - 1
                  ? { type: 'button', onClick: handleNext, disabled: isNextButtonDisabled }
                  : { form: 'widgetAttribute', type: 'submit' }
              }
              cancelProps={{
                onClick: handleBack,
                disabled: activeStep === 0,
              }}
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
          <WidgetTypeSelect widgetType={widgetType} setWidgetType={setWidgetType} />
        ) : (
          <TitleBox title="위젯 속성 설정">
            <WidgetAttributeSelect dataSetId={dataSet} componentType={widgetType} />
          </TitleBox>
        )}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
