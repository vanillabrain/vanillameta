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
import { useNavigate } from 'react-router-dom';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

const WidgetCreate = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const [componentList, setComponentList] = useState([]); // step 1
  const [dataset, setDataset] = useState(null); // step 1
  const [widgetOption, setWidgetOption] = useState(null); // step 2

  useEffect(() => {
    // ------------------ 개발 편의상 임시로 적용
    setDataset({
      createdAt: '2022-10-21T01:59:12.341Z',
      databaseId: 1,
      datasetType: 'DATASET',
      id: 13,
      query:
        '"select A.*, IFNULL(B.productName, C.codeName) as productName\n' +
        'from\n' +
        '    (select *\n' +
        '    from Settlement\n' +
        "    where vendorId = 'A00197496'and\n" +
        '          orderDate < 20220701 and 20220601 <= orderDate) A \n' +
        '    left join Product B\n' +
        '        on A.productId = B.productId\n' +
        "    left join (select code, codeName from CommonCode where pCode='settleDetailType') C\n" +
        '        on C.code = A.settleDetailType"',
      title: 'SattlementSample2',
      updatedAt: '2022-10-21T01:59:12.341Z',
    });
    setWidgetOption({
      id: 9,
      category: 'SQUARE',
      componentType: 'CHART_RADAR',
      description: 'Radar Chart',
      icon: 'icon/ct-radar.svg',
      option: {
        title: '',
        field: '',
        series: [
          {
            aggregation: 'sum',
            color: '#2870c5',
            field: '',
          },
        ],
        legendPosition: '',
      },
      seq: null,
      title: '방사형 차트',
    });
    setActiveStep(2);
    // --------------- 작업 완료 후 삭제예정
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
    componentService.selectComponentList().then(res => {
      // console.log(res.data);
      setComponentList(res.data);
    });
  };

  const saveWidgetInfo = (option, title) => {
    const param = {
      title: title,
      description: title,
      databaseId: dataset.databaseId,
      componentId: widgetOption.id,
      // 'DATASET', 'WIDGET_VIEW'
      datasetType: dataset.datasetType,
      datasetId: dataset.datasetId,
      tableName: '',
      option: option,
    };
    console.log(option);
    widgetService.createWidget(param).then(response => {
      navigate('/widget', { replace: true });
    });
  };

  const handleNext = (event, item) => {
    console.log('component : ', item);
    event.preventDefault();
    if (activeStep === steps.length - 1) {
      return;
    }
    if (activeStep === 0) {
      // setDataset(item);
    }
    if (activeStep === 1) {
      setWidgetOption(item);
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
    <PageContainer>
      <PageTitleBox
        title={title}
        upperTitle="위젯"
        sx={{ paddingLeft: 0, paddingRight: 0, width: '100%', height: '100%' }}
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
        <Box
          sx={{
            border: '1px solid #e3e7ea',
            borderLeft: 0,
            borderRight: 0,
          }}
        >
          <Stepper
            activeStep={activeStep}
            sx={{
              width: { xs: '80%', sm: '50%' },
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

        {activeStep === 0 ? (
          <WidgetDataSelect setDataSet={setDataset} handleNext={handleNext} />
        ) : activeStep === 1 ? (
          <WidgetTypeSelect
            widgetOption={widgetOption}
            setWidgetType={setWidgetOption}
            componentList={componentList}
            handleNext={handleNext}
          />
        ) : (
          <WidgetAttributeSelect dataset={dataset} widgetOption={widgetOption} saveWidgetInfo={saveWidgetInfo} top={72} />
        )}
      </PageTitleBox>
    </PageContainer>
  );
};

export default WidgetCreate;
