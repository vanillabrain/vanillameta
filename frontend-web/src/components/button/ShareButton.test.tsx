import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ShareButton from './ShareButton';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-alert', () => ({ useAlert: () => ({ success: vi.fn(), error: vi.fn() }) }));

const wrap = (data: any) => ({ data: { status: 'SUCCESS', data } });
const reuseToggle = () => screen.getByRole('checkbox', { name: 'share.allowReuse' });
const open = async () => {
  render(<ShareButton dashboardId="12" shareLimitDate="01/01/2027" setShareLimitDate={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'share.button' }));
  await screen.findByRole('checkbox', { name: 'share.allowReuse' });
};
beforeEach(() => {
  api.get.mockReset().mockResolvedValue(wrap({ allowReuse: false }));
  api.post.mockReset();
});
afterEach(cleanup);

it('UC-021 loads the owner reuse setting from the dashboard endpoint when the share popover opens', async () => {
  api.get.mockResolvedValueOnce(wrap({ allowReuse: true }));
  await open();
  expect(api.get).toHaveBeenCalledWith('/bi/dashboards/12/reuse-access');
  await waitFor(() => expect(reuseToggle().getAttribute('aria-checked')).toBe('true'));
});

it('UC-021 saves the reuse setting and only reflects it after the API confirms', async () => {
  await open();
  let resolve: any;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  fireEvent.click(reuseToggle());
  expect(api.post).toHaveBeenCalledWith('/bi/dashboards/12/reuse-access', { allowReuse: true });
  // No optimistic flip and no second click while the save is unresolved.
  expect(reuseToggle().getAttribute('aria-checked')).toBe('false');
  expect(reuseToggle().hasAttribute('disabled')).toBe(true);
  await act(async () => resolve(wrap({ allowReuse: true })));
  await waitFor(() => expect(reuseToggle().getAttribute('aria-checked')).toBe('true'));
  expect(reuseToggle().hasAttribute('disabled')).toBe(false);
});

it('UC-021 keeps the confirmed value and surfaces the error when saving fails', async () => {
  await open();
  api.post.mockRejectedValueOnce({ response: { data: { message: '설정을 저장할 수 없습니다.' } } });
  fireEvent.click(reuseToggle());
  await screen.findByText('설정을 저장할 수 없습니다.');
  expect(reuseToggle().getAttribute('aria-checked')).toBe('false');
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('UC-021 hides the owner reuse setting when no dashboard id is provided', async () => {
  render(<ShareButton shareLimitDate="01/01/2027" setShareLimitDate={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'share.button' }));
  await screen.findByText('share.disallowRead');
  expect(screen.queryByRole('checkbox', { name: 'share.allowReuse' })).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
});
