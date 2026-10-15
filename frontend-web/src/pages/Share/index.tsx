import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import PageViewBox from '../../components/PageViewBox';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';
import { Card } from '@/components/ui/card';
import { useShareDashboard } from './useShareDashboard';

const ResponsiveGridLayout = WidthProvider(Responsive);

const widgetCardClassName = 'h-full w-full overflow-hidden rounded-lg border border-border bg-background shadow-sm';

const Share = () => {
  const { t } = useTranslation();
  const { dashboardUuid } = useParams();
  const { dashboardInfo, layout, isShareOn, isInvalidData, loading } = useShareDashboard(dashboardUuid);

  // widget 생성
  const generateWidget = () => {
    return dashboardInfo.widgets.map(item => {
      return (
        <Card key={item.id} className={widgetCardClassName}>
          <WidgetWrapper widgetOption={item} dataSetId={item.datasetId} />
        </Card>
      );
    });
  };

  // 데이터가 없는 상태별 텍스트
  const generateInvalidText = () => {
    if (loading) {
      return t('share.loading');
    } else if (isInvalidData === 401) {
      return t('share.expired');
    } else {
      return t('share.notFound');
    }
  };

  return !isShareOn ? (
    <PageViewBox className="border-t border-border">
      <div className="flex-auto rounded-b-[6px] bg-muted">
        <p className="mx-auto my-[200px] text-center text-base leading-[1.6] font-semibold whitespace-pre-wrap text-foreground">
          {generateInvalidText()}
        </p>
      </div>
    </PageViewBox>
  ) : (
    <PageViewBox
      title={dashboardInfo.title}
      date={`${dateData(dashboardInfo.updatedAt)}`}
      className="border-t border-border"
    >
      <Seo title={dashboardInfo.title} />
      <div className="flex-auto rounded-b-[6px] bg-muted sm:min-h-[1080px]">
        <ResponsiveGridLayout
          rowHeight={88}
          compactType={null}
          breakpoints={{ xs: 0, md: 800, lg: 1000 }}
          cols={{ xs: 2, md: 8, lg: 12 }}
          layouts={{ xs: layout, md: layout, lg: layout }}
          containerPadding={{ xs: [20, 20], md: [20, 20], lg: [24, 24] }}
          margin={{ xs: [20, 20], md: [20, 20], lg: [24, 24] }}
        >
          {generateWidget()}
        </ResponsiveGridLayout>
      </div>
    </PageViewBox>
  );
};

export default Share;
