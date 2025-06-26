'use client';

import WidgetModify from '@/pages/Widget/WidgetModify';

interface WidgetModifyPageProps {
  params: {
    widgetId: string;
  };
}

export default function WidgetModifyPage({ params }: WidgetModifyPageProps) {
  return <WidgetModify widgetId={params.widgetId} />;
}