import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../src/index.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VanillaMeta',
  description: 'VanillaMeta - 데이터 분석 및 시각화 플랫폼',
  keywords: '데이터 분석, 시각화, 대시보드, 비즈니스 인텔리전스',
  authors: [{ name: 'VanillaMeta Team' }],
  openGraph: {
    title: 'VanillaMeta',
    description: 'VanillaMeta - 데이터 분석 및 시각화 플랫폼',
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VanillaMeta',
    description: 'VanillaMeta - 데이터 분석 및 시각화 플랫폼',
  },
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div id="root">{children}</div>
        </Providers>
      </body>
    </html>
  );
}