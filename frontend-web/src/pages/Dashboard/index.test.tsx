import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import Dashboard from './index';
import DashboardService from '@/api/dashboardService';

jest.mock('@/api/dashboardService');

describe('Dashboard 페이지', () => {
  it('서버에서 받은 대시보드 목록을 렌더링한다', async () => {
    (DashboardService.selectDashboardList as jest.Mock).mockResolvedValue({
      data: {
        status: 'SUCCESS',
        data: [{ id: 1, title: '대시보드1', updatedAt: '2024-01-01' }],
      },
    });

    renderWithProviders(<Dashboard />);

    expect(await screen.findByText('대시보드1')).toBeInTheDocument();
  });

  it('목록이 비어 있으면 안내 문구를 보여준다', async () => {
    (DashboardService.selectDashboardList as jest.Mock).mockResolvedValue({
      data: { status: 'SUCCESS', data: [] },
    });

    renderWithProviders(<Dashboard />);

    expect(await screen.findByText(/생성한 대시보드가 없습니다/)).toBeInTheDocument();
  });
});
