import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoadingContext } from '@/contexts/LoadingContext';

const { alertApi, snackbarApi, service } = vi.hoisted(() => ({
  alertApi: { success: vi.fn(), error: vi.fn() },
  snackbarApi: { success: vi.fn(), error: vi.fn() },
  service: { getSignupMode: vi.fn(), joinWaitlist: vi.fn(), signup: vi.fn() },
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-alert', () => ({ useAlert: (context?: unknown) => (context ? snackbarApi : alertApi) }));
vi.mock('@/api/authService', () => ({ default: service }));
const { token } = vi.hoisted(() => ({ token: { value: null as string | null } }));
vi.mock('@/helpers/authHelper', () => ({ getToken: () => token.value }));
vi.mock('@/assets/images/logo.svg?react', () => ({ default: () => <svg /> }));
vi.mock('@/layouts/Footer', () => ({ Copyright: () => null }));
vi.mock('@/seo/Seo', () => ({ default: () => null }));

import SignUp from './index';

const Where = () => <output data-testid="where">{useLocation().pathname + useLocation().search}</output>;

const show = (url = '/signup') =>
  render(
    <LoadingContext.Provider value={{ showLoading: vi.fn(), hideLoading: vi.fn() } as never}>
      <MemoryRouter initialEntries={[url]}>
        <SignUp />
        <Where />
      </MemoryRouter>
    </LoadingContext.Provider>,
  );

// Required fields append an asterisk to their label text.
const label = (name: string) => new RegExp(`^${name}`);
const mode = (value: string) => service.getSignupMode.mockResolvedValue({ data: { mode: value } });

const fillAccount = () => {
  fireEvent.change(screen.getByLabelText(label('User ID')), { target: { name: 'userId', value: 'tester01' } });
  fireEvent.change(screen.getByLabelText(label('Password')), { target: { name: 'userPwd', value: 'Abcd1234!' } });
  fireEvent.change(screen.getByLabelText(label('Confirm Password')), {
    target: { name: 'userConfirmPwd', value: 'Abcd1234!' },
  });
  fireEvent.change(screen.getByLabelText(label('E-mail')), { target: { name: 'userEmail', value: 'tester@example.com' } });
};

beforeEach(() => {
  vi.clearAllMocks();
  token.value = null;
  service.signup.mockResolvedValue({ status: 201 });
});
afterEach(cleanup);

it('asks for an invite code in invite mode, prefills it from ?invite= and sends it trimmed', async () => {
  mode('invite');
  show('/signup?invite=vm-abc');
  const field = (await screen.findByLabelText(label('signup.inviteCode'))) as HTMLInputElement;
  expect(field.value).toBe('vm-abc');
  fillAccount();
  fireEvent.change(field, { target: { name: 'inviteCode', value: '  vm-xyz  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'signup.submit' }));
  await waitFor(() => expect(service.signup).toHaveBeenCalledTimes(1));
  expect(service.signup).toHaveBeenCalledWith({
    userId: 'tester01',
    password: 'Abcd1234!',
    email: 'tester@example.com',
    inviteCode: 'vm-xyz',
  });
});

it('does not submit in invite mode without a code', async () => {
  mode('invite');
  show();
  await screen.findByLabelText(label('signup.inviteCode'));
  fillAccount();
  fireEvent.click(screen.getByRole('button', { name: 'signup.submit' }));
  expect(service.signup).not.toHaveBeenCalled();
  expect(snackbarApi.error).toHaveBeenCalledWith('signup.inviteRequired');
});

it('has no invite field in open mode and sends no code', async () => {
  mode('open');
  show('/signup?invite=ignored');
  await waitFor(() => expect(service.getSignupMode).toHaveBeenCalled());
  await screen.findByRole('button', { name: 'signup.submit' });
  expect(screen.queryByLabelText(label('signup.inviteCode'))).toBeNull();
  expect(screen.queryByText('signup.waitlistTitle')).toBeNull();
  fillAccount();
  fireEvent.click(screen.getByRole('button', { name: 'signup.submit' }));
  await waitFor(() => expect(service.signup).toHaveBeenCalledTimes(1));
  expect(service.signup.mock.calls[0][0]).not.toHaveProperty('inviteCode');
});

it('shows only the waiting list when signup is closed', async () => {
  mode('closed');
  service.joinWaitlist.mockResolvedValue({ status: 202 });
  show();
  expect(await screen.findByText('signup.closed')).toBeTruthy();
  expect(screen.queryByLabelText(label('User ID'))).toBeNull();
  fireEvent.change(screen.getByLabelText(label('signup.waitlistEmail')), { target: { value: 'wait@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'signup.waitlistSubmit' }));
  await waitFor(() => expect(service.joinWaitlist).toHaveBeenCalledWith('wait@example.com'));
  expect(await screen.findByText('signup.waitlistDone')).toBeTruthy();
});

it('keeps the form usable with an invite field when the mode request fails', async () => {
  service.getSignupMode.mockRejectedValue(new Error('network'));
  show();
  expect(await screen.findByLabelText(label('signup.inviteCode'))).toBeTruthy();
});

it('reports a refused invitation with its own message', async () => {
  mode('invite');
  service.signup.mockRejectedValue({ response: { status: 403, data: { data: { error: 'INVITE_INVALID' } } } });
  show();
  await screen.findByLabelText(label('signup.inviteCode'));
  fillAccount();
  fireEvent.change(screen.getByLabelText(label('signup.inviteCode')), { target: { name: 'inviteCode', value: 'vm-used' } });
  fireEvent.click(screen.getByRole('button', { name: 'signup.submit' }));
  await waitFor(() => expect(alertApi.error).toHaveBeenCalledWith('signup.inviteInvalid'));
});

it('removes only the invite parameter from the address bar once it has been read', async () => {
  mode('invite');
  show('/signup?invite=vm-abc&utm=mail');
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/signup?utm=mail'));
  expect(((await screen.findByLabelText(label('signup.inviteCode'))) as HTMLInputElement).value).toBe('vm-abc');
});

it('does not undo the dashboard redirect of a signed-in visitor by scrubbing the address', async () => {
  token.value = 'signed-in';
  mode('invite');
  show('/signup?invite=vm-abc');
  await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/dashboard'));
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(screen.getByTestId('where').textContent).toBe('/dashboard');
});
