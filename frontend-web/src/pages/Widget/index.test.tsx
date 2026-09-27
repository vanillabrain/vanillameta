import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import Widget from './index';
import WidgetService from '@/api/widgetService';

jest.mock('@/api/widgetService');

describe('Widget 페이지', () => {
  it('서버에서 받은 위젯 목록을 렌더링한다', async () => {
    (WidgetService.selectWidgetList as jest.Mock).mockResolvedValue({
      data: {
        status: 'SUCCESS',
        data: [{ id: 1, title: '위젯1', updatedAt: '2024-01-01' }],
      },
    });

    renderWithProviders(<Widget />);

    expect(await screen.findByText('위젯1')).toBeInTheDocument();
  });

  it('목록이 비어 있으면 안내 문구를 보여준다', async () => {
    (WidgetService.selectWidgetList as jest.Mock).mockResolvedValue({
      data: { status: 'SUCCESS', data: [] },
    });

    renderWithProviders(<Widget />);

    expect(await screen.findByText(/생성한 위젯이 없습니다/)).toBeInTheDocument();
  });
});
