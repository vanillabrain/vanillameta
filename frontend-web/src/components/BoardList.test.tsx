import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import BoardList from './BoardList';

describe('BoardList', () => {
  it('전달받은 항목의 제목을 렌더링한다', () => {
    renderWithProviders(
      <BoardList
        postList={[{ id: 1, title: '대시보드A', updatedAt: '2024-01-01' }]}
        handleDeleteSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('대시보드A')).toBeInTheDocument();
  });
});
