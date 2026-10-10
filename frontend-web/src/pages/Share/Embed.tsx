import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Card, Typography } from '@mui/material';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useShareDashboard } from './useShareDashboard';
import Seo from '@/seo/Seo';

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * iframe 임베딩 전용 대시보드 — 헤더/푸터 없이 대시보드만 렌더링
 * 사용법: <iframe src="{origin}/embed/{uuid}" />
 * ?title=false 로 타이틀바 숨김 처리 가능
 * iframe 내에서 실행 중이면 부모 창에 {type:'vanillameta:embed-height', uuid, height}
 * 메시지를 postMessage로 보내 높이 자동조절을 지원한다.
 */
const Embed = () => {
  const { t } = useTranslation();
  const { dashboardUuid } = useParams();
  const [searchParams] = useSearchParams();
  const showTitle = searchParams.get('title') !== 'false';
  const { dashboardInfo, layout, isShareOn, isInvalidData, loading } = useShareDashboard(dashboardUuid);
  const rootRef = useRef<HTMLDivElement>(null);

  // REACT_APP_EMBED_ALLOWED_DOMAINS 설정 시 referrer 도메인 검증 (정적 호스팅 환경에서의 보완책)
  const allowedDomains = (import.meta.env.REACT_APP_EMBED_ALLOWED_DOMAINS || '')
    .split(',')
    .map((d: string) => d.trim())
    .filter(Boolean);
  const isAllowedEmbed = (() => {
    if (allowedDomains.length === 0) return true;
    if (window.parent === window) return true; // 직접 접속은 허용
    try {
      const refHost = new URL(document.referrer).hostname;
      return allowedDomains.includes(refHost);
    } catch {
      return false; // referrer 없음(정책상 차단됨) → allowlist 설정 시 불허
    }
  })();

  // iframe 내에서만 부모 창에 높이를 통지 (호스트 페이지에서 iframe 높이 자동조절용)
  useEffect(() => {
    if (window.parent === window || !rootRef.current) return;
    const el = rootRef.current;
    const observer = new ResizeObserver(() => {
      window.parent.postMessage({ type: 'vanillameta:embed-height', uuid: dashboardUuid, height: el.scrollHeight }, '*');
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [dashboardUuid, isShareOn]);

  if (!isShareOn || !isAllowedEmbed) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#333', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
          {!isAllowedEmbed
            ? t('embed.notAllowed')
            : loading
              ? t('embed.loading')
              : isInvalidData === 401
                ? t('embed.expired')
                : t('embed.unavailable')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={rootRef} sx={{ width: '100%', minHeight: '100vh', backgroundColor: '#f9f9fa' }}>
      <Seo title={dashboardInfo.title} />
      {showTitle && (
        <Typography
          sx={{
            px: '20px',
            pt: '16px',
            fontSize: '18px',
            fontWeight: 600,
            color: '#141414',
          }}
        >
          {dashboardInfo.title}
        </Typography>
      )}
      <ResponsiveGridLayout
        rowHeight={88}
        compactType={null}
        breakpoints={{ xs: 0, md: 800, lg: 1000 }}
        cols={{ xs: 2, md: 8, lg: 12 }}
        layouts={{ xs: layout, md: layout, lg: layout }}
        containerPadding={{ xs: [12, 12], md: [16, 16], lg: [20, 20] }}
        margin={{ xs: [12, 12], md: [16, 16], lg: [20, 20] }}
      >
        {dashboardInfo.widgets.map(item => (
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
        ))}
      </ResponsiveGridLayout>
    </Box>
  );
};

export default Embed;
