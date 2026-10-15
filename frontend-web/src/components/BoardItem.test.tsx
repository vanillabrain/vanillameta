import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BoardItem from './BoardItem';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const renderItem = (id: string | number) =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ul>
              <BoardItem
                data={{ id, title: 'Sample dashboard', updatedAt: '2026-10-15T00:00:00.000Z' }}
                handleDeleteSelect={vi.fn()}
              />
            </ul>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

it('keeps the numeric dashboard id inside the row link path', () => {
  renderItem(1);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/1');
});

it('keeps string ids unchanged', () => {
  renderItem('widget-42');
  expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/widget-42');
});
