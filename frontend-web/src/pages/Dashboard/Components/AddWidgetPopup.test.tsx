import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoadingContext } from '@/contexts/LoadingContext';
import AddWidgetPopup from './AddWidgetPopup';

const mocks = vi.hoisted(() => ({ list: vi.fn(), error: vi.fn() }));
vi.mock('@/api/widgetService', () => ({ default: { selectWidgetList: mocks.list } }));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: mocks.error, info: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const mount = (onSelect = vi.fn()) => {
  render(
    <LoadingContext.Provider value={{ loading: false, showLoading: vi.fn(), hideLoading: vi.fn() }}>
      <AddWidgetPopup label="Choose widgets" widgetOpen widgetSelect={onSelect} useWidgetIds={[2]} />
    </LoadingContext.Provider>,
  );
  return onSelect;
};

it('reads the Axios payload, excludes used widgets and returns the selected widget', async () => {
  const widget = { id: 1, title: 'Revenue', icon: '', option: {} };
  mocks.list.mockResolvedValue({ status: 200, data: { status: 'SUCCESS', data: [widget, { id: 2, title: 'Used' }] } });
  const onSelect = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Revenue' }));
  expect(screen.queryByRole('button', { name: 'Used' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'common.addWidget' }));
  expect(onSelect).toHaveBeenCalledWith([widget]);
});

it('reports a failed list request instead of silently showing an empty list', async () => {
  mocks.list.mockRejectedValue(new Error('network'));
  mount();
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('common:messages.error'));
});
