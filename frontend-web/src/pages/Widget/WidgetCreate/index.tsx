import React, { useState, useEffect } from 'react';
import { Box, Stack, Step, StepLabel, Stepper } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';
import PageContainer from '@/components/PageContainer';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import TitleBox from '@/components/TitleBox';
import WidgetDataSelect from './WidgetDataSelect';
import WidgetTypeSelect from './WidgetTypeSelect';
import WidgetAttributeSelect from './WidgetAttributeSelect';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

function WidgetCreate(props) {
  const [activeStep, setActiveStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const [dataSet, setDataSet] = useState(null); // step 1
  const [widgetType, setWidgetType] = useState('barChart'); // step 2 : 개발 편의상 임시로 lineChart 적용
  const [widgetOption, setWidgetOption] = useState(null); // step 3
  const [widgetTitle, setWidgetTitle] = useState(null);

  const handleNext = () => {
    // switch (activeStep) {
    //   case 0:
    //     // 데이터셋 선택
    //     if (!dataSet) {
    //       return;
    //     }
    //     break;
    //   case 1:
    //     //
    //     break;
    //   case 2:
    //     break;
    //   default:
    // }
    // console.log(activeStep);
    if (activeStep < steps.length - 1) {
      setActiveStep(prevActiveStep => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prevActiveStep => prevActiveStep - 1);
    }
  };

  // 위젯 속성 저장
  const handleSubmit = event => {
    event.preventDefault();
    console.log('datesetId:', dataSet);
    console.log('widgetType:', widgetType);
    console.log('widgetOption:', widgetOption);
    // console.log('widgetTitle:', widgetTitle);
  };

  return (
    <PageContainer>
      <PageTitleBox
        title={title}
        button={
          <Stack>
            <ConfirmCancelButton
              confirmLabel={activeStep === steps.length - 1 ? '저장' : '다음'}
              cancelLabel="이전"
              confirmProps={{
                form: 'widgetAttribute',
                onClick: activeStep === steps.length - 1 ? handleSubmit : handleNext,
                // disabled: activeStep === steps.length - 1,
              }}
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
        </Box>

        {activeStep === 0 ? (
          <WidgetDataSelect setDataSet={setDataSet} />
        ) : activeStep === 1 ? (
          <WidgetTypeSelect widgetType={widgetType} setWidgetType={setWidgetType} />
        ) : (
          <TitleBox title="위젯 속성 설정">
            <WidgetAttributeSelect dataSetId={dataSet} componentType={widgetType} setWidgetOption={setWidgetOption} />
          </TitleBox>
        )}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
