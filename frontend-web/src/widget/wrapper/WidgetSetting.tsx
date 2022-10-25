import React, { useEffect, useState } from 'react';
import { Divider, List, Stack, styled, Typography } from '@mui/material';
import { WIDGET_TYPE } from '@/constant';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import NumericBoardSetting from '@/widget/settings/NumericBoardSetting';
import TableBoardSetting from '@/widget/settings/TableBoardSetting';
import MixedLineBarChartSetting from '@/widget/settings/MixedLineBarChartSetting';
import DonutChartSetting from '@/widget/settings/DonutChartSetting';
import ScatterChartSetting from '@/widget/settings/ScatterChartSetting';
import BubbleChartSetting from '@/widget/settings/BubbleChartSetting';
import RadarChartSetting from '@/widget/settings/RadarChartSetting';
import TreemapChartSetting from '@/widget/settings/TreemapChartSetting';
import HeatmapChartSetting from '@/widget/settings/HeatmapChartSetting';
import GaugeChartSetting from '@/widget/settings/GaugeChartSetting';
import CandlestickChartSetting from '@/widget/settings/CandlestickChartSetting';
import Bar3DChartSetting from '@/widget/settings/Bar3DChartSetting';
import Line3DChartSetting from '@/widget/settings/Line3DChartSetting';
import Scatter3DChartSetting from '@/widget/settings/Scatter3DChartSetting';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import Bubble3DChartSetting from '@/widget/settings/Bubble3DChartSetting';
import WaterfallChartSetting from '@/widget/settings/WaterfallChartSetting';
import PolarBarChartSetting from '@/widget/settings/PolarBarChartSetting';
import MixedLinePieChartSetting from '@/widget/settings/MixedLinePieChartSetting';
import MixedDonutPieChartSetting from '@/widget/settings/MixedDonutPieChartSetting';
import MixedLineStackedBarChartSetting from '@/widget/settings/MixedLineStackedBarChartSetting';
import FunnelChartSetting from '@/widget/settings/FunnelChartSetting';
import { ConfirmButton } from '@/components/button/ConfirmCancelButton';

const StyledList = styled(List)({
  padding: 0,

  '& .MuiListItemText-root': {
    width: '100%',
  },
  '& .MuiListItemText-primary': {
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  '& .MuiListItem-root': {
    display: 'flex',
    flexDirection: ' column',
    rowGap: 8,
    width: '100%',
    padding: '30px 0 30px',
    fontSize: '14px',

    hr: {
      height: '4px',
    },
  },
});

const WidgetSetting = props => {
  const { title, setTitle, widgetOption, setWidgetOption, widgetType, widgetName, widgetDescription, dataSet, spec } = props;

  const [module, setModule] = useState(null);
  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderWidgetSetting();
  }, [widgetType, widgetOption, spec, dataSet]);

  const renderWidgetSetting = () => {
    let module = null;
    const chartSettingProps = {
      option: widgetOption,
      setOption: setWidgetOption,
      spec,
      dataSet,
    };

    switch (widgetType) {
      case WIDGET_TYPE.BOARD_NUMERIC:
        module = <NumericBoardSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.BOARD_TABLE:
        module = <TableBoardSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_LINE:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_LINE:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_AREA:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_AREA:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_BAR:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_BAR:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_COLUMN:
        module = <LineChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_STACKED_COLUMN:
        module = <LineChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BAR:
        module = <MixedLineBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_PIE:
        module = <PieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_DONUT:
        module = <DonutChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_NIGHTINGALE:
        module = <DonutChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_SCATTER:
        module = <ScatterChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_BUBBLE:
        module = <BubbleChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_RADAR:
        module = <RadarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_TREEMAP:
        module = <TreemapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_HEATMAP:
        module = <HeatmapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_SUNBURST:
        module = <TreemapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_GAUGE:
        module = <GaugeChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_CANDLESTICK:
        module = <CandlestickChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_FUNNEL:
        module = <FunnelChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_BAR:
        module = <Bar3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_LINE:
        module = <Line3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_SCATTER:
        module = <Scatter3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_BUBBLE:
        module = <Bubble3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_WATERFALL_BAR:
        module = <WaterfallChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_WATERFALL_COLUMN:
        module = <WaterfallChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_POLAR_BAR:
        module = <PolarBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_POLAR_STACKED_BAR:
        module = <PolarBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_AREA_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_COLUMN_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_PIE:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_DONUT_PIE:
        module = <MixedDonutPieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_PIE:
        module = <MixedDonutPieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_STACKED_BAR:
        module = <MixedLineStackedBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting
              {...chartSettingProps}
              // option={widgetOption.numericOption}
            />
            <Divider />
            <LineChartSetting
              {...chartSettingProps}
              // option={widgetOption.chartOption}
            />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_AREA_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_COLUMN_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} axis="y" />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} axis="y" />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_DONUT_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <DonutChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <DonutChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;

      default:
        module = '컴포넌트가 선택되지 않았다!';
        break;
    }

    setModule(module);
  };

  return (
    <Stack
      sx={{
        width: '440px',
        height: '100vh',
        px: '24px',
        py: '30px',
        overflowY: 'auto !important',
        flex: 'auto',
        minHeight: 0,
        minWidth: 0,
        backgroundColor: '#fff',
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontWeight: 'bold',
          color: '#767676',
          mb: '16px',
        }}
      >
        {widgetName}
        <Typography component="span">{`(${widgetDescription})`}</Typography>
      </Typography>
      <WidgetTitleForm value={title} onChange={event => setTitle(event.target.value)} />
      <Divider sx={{ mt: '30px' }} />

      <StyledList>{module}</StyledList>

      <ConfirmButton
        sx={{ mt: '30px' }}
        confirmLabel="저장"
        confirmProps={{
          form: 'widgetAttribute',
          type: 'submit',
          variant: 'contained',
        }}
      />
    </Stack>
  );
};

export default WidgetSetting;
