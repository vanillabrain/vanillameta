import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Box, Card, Typography } from '@mui/material';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import PageViewBox from '../../components/PageViewBox';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';
import { useShareDashboard } from './useShareDashboard';

const ResponsiveGridLayout = WidthProvider(Responsive);

const Share = () => {
  const { t } = useTranslation();
  const { dashboardUuid } = useParams();
  const { dashboardInfo, layout, isShareOn, isInvalidData, loading } = useShareDashboard(dashboardUuid);

  // widget 생성
  const generateWidget = () => {
    return dashboardInfo.widgets.map(item => {
      return (
        <Card
          key={item.id}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
            border: 'solid 1px #e2e2e2',
            backgroundColor: '#fff',
          }}
        >
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
    <PageViewBox sx={{ borderTop: '1px solid #ddd' }}>
      <Box
        sx={{
          flex: '1 1 auto',
          backgroundColor: '#f9f9fa',
          borderRadius: '0px 0px 6px 6px',
        }}
      >
        <Typography
          sx={{
            margin: '200px auto',
            fontSize: '16px',
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            color: '#333',
          }}
        >
          {generateInvalidText()}
        </Typography>
      </Box>
    </PageViewBox>
  ) : (
    <PageViewBox
      title={dashboardInfo.title}
      date={`${dateData(dashboardInfo.updatedAt)}`}
      sx={{ borderTop: '1px solid #ddd' }}
    >
      <Seo title={dashboardInfo.title} />
      <Box
        sx={{
          flex: '1 1 auto',
          minHeight: { sm: '1080px' },
          backgroundColor: '#f9f9fa',
          borderRadius: '0px 0px 6px 6px',
        }}
      >
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
      </Box>
    </PageViewBox>
  );
};

export default Share;
