import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PageTitleBox from './PageTitleBox';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const mount = children => render(<MemoryRouter>{children}</MemoryRouter>);

it('keeps one page action visible for the mobile header', () => {
  mount(
    <PageTitleBox title="Metrics" button={<button type="button">Add metric</button>}>
      <div>Metric body</div>
    </PageTitleBox>,
  );
  const actions = screen.getAllByRole('button', { name: 'Add metric' });
  expect(actions).toHaveLength(1);
  const container = actions[0].parentElement as HTMLElement;
  expect(container.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  expect(container.className).toContain('flex-wrap');
  expect(screen.getByText('Metric body')).toBeTruthy();
});

it('links the upper title and keeps the page title as the reload action', () => {
  mount(
    <PageTitleBox title="Metrics" upperTitle="Data" upperTitleLink="/data">
      <div>Metric body</div>
    </PageTitleBox>,
  );
  expect(screen.getByRole('link', { name: 'Data' }).getAttribute('href')).toBe('/data');
  expect(screen.getByRole('button', { name: 'Metrics' })).toBeTruthy();
});
