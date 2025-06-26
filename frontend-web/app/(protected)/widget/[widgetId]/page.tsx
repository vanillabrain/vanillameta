'use client';

import WidgetView from '@/pages/Widget/WidgetView';

interface WidgetViewPageProps {
  params: {
    widgetId: string;
  };
}

export default function WidgetViewPage({ params }: WidgetViewPageProps) {
  return <WidgetView widgetId={params.widgetId} />;
}