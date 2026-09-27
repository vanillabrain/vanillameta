import { useContext, useEffect, useState } from 'react';
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
import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const title = '위젯 생성';
const steps = ['데이터 선택', '위젯 타입 선택', '위젯 속성 설정'];

const WidgetCreate = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const [dataset, setDataset] = useState(null); // step 1
  const [widgetOption, setWidgetOption] = useState(null); // step 2
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  // 컴포넌트 목록 조회
  const { data: componentList = [] } = useQuery({
    queryKey: ['components'],
    queryFn: async () => (await componentService.selectComponentList()).data,
  });

  const [isNextButtonDisabled, setIsNextButtonDisabled] = useState(true);

  // 위젯 저장
  const saveMutation = useMutation({
    mutationFn: (param: any) => widgetService.createWidget(param),
  });

  const isMutating = saveMutation.isPending;
  const fetchingCount = useIsFetching();
  useEffect(() => {
    if (fetchingCount > 0 || isMutating) {
      showLoading();
    } else {
      hideLoading();
    }
  }, [fetchingCount, isMutating]);

  useEffect(() => {
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

  const saveWidgetInfo = async (option, widgetTitle) => {
    const param: any = {
      title: widgetTitle,
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

    const response = await saveMutation.mutateAsync(param);
    if (response.data.status === 'SUCCESS') {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      navigate('/widget');
    }
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
