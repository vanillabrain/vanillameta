import React, { useState } from 'react';
import { Box, Button, Grid, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import PageTitleBox from '../../components/PageTitleBox';
import PageContainer from '../../components/PageContainer';
import ConfirmButton from '../../components/ConfirmButton';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

function WidgetCreate(props) {
  const [activeStep, setActiveStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prevActiveStep => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prevActiveStep => prevActiveStep - 1);
    }
  };

  const handleFinish = () => {
    setIsFinished(true);
    console.log('finished');
  };

  return (
    <PageContainer>
      <PageTitleBox title={title} disabled={!isFinished}>
        <Box>
          <Stepper activeStep={activeStep} sx={{ width: '70%', m: 'auto', mt: 8, mb: 6 }}>
            {steps.map((label, index) => {
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

          <Stack alignItems="flex-end" sx={{ width: '100%' }}>
            <ConfirmButton
              primary={{
                label: activeStep === steps.length - 1 ? '완료' : '다음',
                onClick: activeStep === steps.length - 1 ? handleFinish : handleNext,
                disabled: activeStep === steps.length,
              }}
              secondary={{
                label: '이전',
                onClick: handleBack,
                disabled: activeStep === 0,
              }}
            />
          </Stack>
        </Box>
        {/*<Typography sx={{ mt: 2, mb: 1 }}>Step {activeStep + 1}</Typography>*/}
        {activeStep === 0 ? <WidgetDataSelect /> : activeStep === 1 ? <WidgetTypeSelect /> : <WidgetAttributeSelect />}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
