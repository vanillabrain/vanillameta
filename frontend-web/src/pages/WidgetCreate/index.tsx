import React from 'react';
import { Box, Button, Step, StepLabel, Stepper, Typography } from '@mui/material';
import PageTitleBox from '../../components/PageTitleBox';
import DataTable from '../../components/DataTable';
import PageContainer from '../../components/PageContainer';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

function WidgetCreate(props) {
  const [activeStep, setActiveStep] = React.useState(0);

  const handleNext = () => {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <PageContainer>
      <PageTitleBox title={title}>
        <Box sx={{ width: '70%', m: 'auto', mt: 2, mb: 8 }}>
          <Stepper activeStep={activeStep}>
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
          {/*{activeStep === steps.length ? (*/}
          {/*  <React.Fragment>*/}
          {/*    <Typography sx={{ mt: 2, mb: 1 }}>All steps completed - you&apos;re finished</Typography>*/}
          {/*    <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>*/}
          {/*      <Box sx={{ flex: '1 1 auto' }} />*/}
          {/*      <Button onClick={handleReset}>Reset</Button>*/}
          {/*    </Box>*/}
          {/*  </React.Fragment>*/}
          {/*) : (*/}
          {/*  <React.Fragment>*/}
          {/*    <Typography sx={{ mt: 2, mb: 1 }}>Step {activeStep + 1}</Typography>*/}
          {/*    <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>*/}
          {/*      <Button color="inherit" disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>*/}
          {/*        Back*/}
          {/*      </Button>*/}
          {/*      <Box sx={{ flex: '1 1 auto' }} />*/}
          {/*      {isStepOptional(activeStep) && (*/}
          {/*        <Button color="inherit" onClick={handleSkip} sx={{ mr: 1 }}>*/}
          {/*          Skip*/}
          {/*        </Button>*/}
          {/*      )}*/}
          {/*      <Button onClick={handleNext}>{activeStep === steps.length - 1 ? 'Finish' : 'Next'}</Button>*/}
          {/*    </Box>*/}
          {/*  </React.Fragment>*/}
          {/*)}*/}
        </Box>
        <DataTable />
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
