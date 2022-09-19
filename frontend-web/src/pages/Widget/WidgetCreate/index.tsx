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
  const [widgetType, setWidgetType] = useState(null); // step 2 : 개발 편의상 임시로 적용
  const [widgetOption, setWidgetOption] = useState(null); // step 3
  const [widgetTitle, setWidgetTitle] = useState(null);

  useEffect(() => {
    if (!widgetOption) {
      return;
    }
    setWidgetTitle(widgetOption.title);
    setIsWidgetValueValid(true);
  }, [widgetOption]);

  // validation
  // 1. dataSet === null 이면 다음 단계로 넘어가지 않음(버튼 비활성)
  // 2. widgetType === null 이면 다음 단계로 넘어가지 않음(버튼 비활성)
  // 3. widgetOption이 유효하지 않으면 onSubmit 못하게(버튼은 활성되지만 저장하면 error 상태 보여주기)
  //   3-1. widgetTitle이 없으면 error
  //   3-2. widgetAttr 필요한 속성이 없으면 error

  const [isWidgetValueValid, setIsWidgetValueValid] = useState(false);
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

    if (activeStep === steps.length - 1) {
      setIsNextButtonDisabled(false);
      return;
    }

    setIsNextButtonDisabled(true);
  }, [activeStep, dataSet, widgetType, isWidgetValueValid]);

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

  // 위젯 속성 저장
  const handleSubmit = event => {
    event.preventDefault();

    // if (!!widgetOption) {
    //   if (widgetOption.title.trim() === '') {
    //     setIsWidgetValueValid(false);
    //     return;
    //   }
    //   if (widgetOption.title.length > 20) {
    //     setIsWidgetValueValid(false);
    //     return;
    //   }
    // }
    console.log('datesetId:', dataSet);
    console.log('widgetType:', widgetType);
    console.log('widgetTitle:', widgetTitle);
    console.log('widgetOption:', widgetOption);
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
                disabled: isNextButtonDisabled,
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
            <WidgetAttributeSelect
              dataSetId={dataSet}
              componentType={widgetType}
              setWidgetOption={setWidgetOption}
              setIsValid={setIsWidgetValueValid}
            />
          </TitleBox>
        )}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetCreate;
