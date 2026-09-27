import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatasetCardList } from './DatasetCardList';

describe('DatasetCardList', () => {
  const data = [
    { id: 1, title: '데이터셋 A' },
    { id: 2, tableName: 'table_b' },
  ] as any;

  it('항목 제목(또는 테이블명)을 렌더링한다', () => {
    render(<DatasetCardList data={data} selectedData={data[0]} />);

    expect(screen.getByText('데이터셋 A')).toBeInTheDocument();
    expect(screen.getByText('table_b')).toBeInTheDocument();
  });

  it('항목 클릭 시 handleDataClick 을 호출한다', () => {
    const handleDataClick = jest.fn();
    render(
      <DatasetCardList data={data} selectedData={data[0]} handleDataClick={handleDataClick} />,
    );

    fireEvent.click(screen.getByText('데이터셋 A'));

    expect(handleDataClick).toHaveBeenCalledWith(data[0]);
  });
});
