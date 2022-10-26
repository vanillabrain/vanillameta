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
      case WIDGET_TYPE.BOARD_NUMERIC.type:
        module = <NumericBoardSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.BOARD_TABLE.type:
        module = <TableBoardSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_LINE.type:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_LINE.type:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_AREA.type:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_AREA.type:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_BAR.type:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_BAR.type:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_COLUMN.type:
        module = <LineChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_STACKED_COLUMN.type:
        module = <LineChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BAR.type:
        module = <MixedLineBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_PIE.type:
        module = <PieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_DONUT.type:
        module = <DonutChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_NIGHTINGALE.type:
        module = <DonutChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_SCATTER.type:
        module = <ScatterChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_BUBBLE.type:
        module = <BubbleChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_RADAR.type:
        module = <RadarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_TREEMAP.type:
        module = <TreemapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_HEATMAP.type:
        module = <HeatmapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_SUNBURST.type:
        module = <TreemapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_GAUGE.type:
        module = <GaugeChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_CANDLESTICK.type:
        module = <CandlestickChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_FUNNEL.type:
        module = <FunnelChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_BAR.type:
        module = <Bar3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_LINE.type:
        module = <Line3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_SCATTER.type:
        module = <Scatter3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_BUBBLE.type:
        module = <Bubble3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_WATERFALL_BAR.type:
        module = <WaterfallChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_WATERFALL_COLUMN.type:
        module = <WaterfallChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_POLAR_BAR.type:
        module = <PolarBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_POLAR_STACKED_BAR.type:
        module = <PolarBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_AREA_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_COLUMN_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_PIE.type:
        module = <MixedLinePieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_DONUT_PIE.type:
        module = <MixedDonutPieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_PIE.type:
        module = <MixedDonutPieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_STACKED_BAR.type:
        module = <MixedLineStackedBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BOARD_NUMERIC.type:
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
      case WIDGET_TYPE.MIXED_CHART_AREA_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_COLUMN_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} axis="y" />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <LineChartSetting {...chartSettingProps} axis="y" />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_DONUT_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoardSetting {...chartSettingProps} />
            <Divider />
            <DonutChartSetting {...chartSettingProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC.type:
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
      justifyContent="space-between"
      sx={{
        width: '40%',
        maxWidth: '440px',
        minWidth: '340px',
        height: '100%',
        px: '24px',
        py: '30px',
        overflowY: 'auto !important',
        backgroundColor: '#fff',
      }}
    >
      <Stack>
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
      </Stack>
      <ConfirmButton
        sx={{ minHeight: '44px', mt: '30px', fontWeight: 'bold', backgroundColor: '#043f84' }}
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
