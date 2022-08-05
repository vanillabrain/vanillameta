import React from 'react';
import { Box, Button, Grid, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import PageTitleBox from '../../components/PageTitleBox';
import DataTable from '../../components/DataTable';
import PageContainer from '../../components/PageContainer';
import ConfirmButton from '../../components/ConfirmButton';
import TitleBox from '../../components/TitleBox';
import CardList from '../../components/CardList';

// TODO: 리팩토링

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

const dataSource = [
  { key: 0, label: '데이터베이스 1' },
  { key: 1, label: '데이터베이스 2' },
  { key: 2, label: '데이터베이스 3' },
];
const dataSet = [
  { key: 0, label: '데이터 셋 1' },
  { key: 1, label: '데이터 셋 2' },
  { key: 2, label: '데이터 셋 3' },
  { key: 3, label: '데이터 셋 4' },
  { key: 4, label: '데이터 셋 5' },
];
const dataList = [
  { key: 0, label: '데이터 목록 1' },
  { key: 1, label: '데이터 목록 2' },
  { key: 2, label: '데이터 목록 3' },
  { key: 3, label: '데이터 목록 4' },
  { key: 4, label: '데이터 목록 5' },
  { key: 5, label: '데이터 목록 6' },
  { key: 6, label: '데이터 목록 7' },
];

function WidgetCreate(props) {
  const [activeStep, setActiveStep] = React.useState(0);

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

  return (
    <PageContainer>
      <PageTitleBox title={title} disabled>
        {/*//---*/}
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
          {/*//---*/}
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
          {/*    /!*<Typography sx={{ mt: 2, mb: 1 }}>Step {activeStep + 1}</Typography>*!/*/}

          {/*    /!*<Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>*!/*/}
          {/*    /!*  <Button color="inherit" disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>*!/*/}
          {/*    /!*    Back*!/*/}
          {/*    /!*  </Button>*!/*/}
          {/*    /!*  <Box sx={{ flex: '1 1 auto' }} />*!/*/}

          {/*    /!*  <Button onClick={handleNext}>{activeStep === steps.length - 1 ? 'Finish' : 'Next'}</Button>*!/*/}
          {/*    /!*</Box>*!/*/}
          {/*  </React.Fragment>*/}
          {/*)}*/}
          <Stack alignItems="flex-end" sx={{ width: '100%' }}>
            <ConfirmButton
              primary={{
                label: '다음',
                onClick: handleNext,
                disabled: activeStep === steps.length - 1,
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

        {/*//---*/}
        {/*<DataTable />*/}
        <Box>
          <Grid container spacing={5}>
            <Grid item xs={12} md={4}>
              <TitleBox
                title={'데이터 소스'}
                naviUrl={props.naviUrl ? props.naviUrl.dataConnectUrl : false}
                fastCreate
                edit
                delete
              >
                <CardList data={dataSource} minWidth="100%" />
              </TitleBox>
            </Grid>
            <Grid item xs={12} md>
              <Grid container spacing={5}>
                <Grid item xs={12}>
                  <TitleBox title={'데이터 셋'} naviUrl={props.naviUrl ? props.naviUrl.dataSetUrl : false}>
                    <CardList data={dataSet} />
                  </TitleBox>
                </Grid>
                <Grid item xs={12}>
                  <TitleBox title={'데이터 목록'} data={dataList}>
                    <CardList data={dataList} />
                  </TitleBox>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Box>
        {/*  */}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
