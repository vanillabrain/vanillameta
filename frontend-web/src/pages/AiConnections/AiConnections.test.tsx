import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { aiConnectionsService, AiConnectionList, ConsentRequest } from '@/api/aiConnectionsService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import AiConnections from './index';
import Approve from './Approve';
vi.mock('@/api/aiConnectionsService', () => ({
  aiConnectionsService: { list: vi.fn(), request: vi.fn(), decide: vi.fn(), disconnect: vi.fn() },
}));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: vi.fn(() => 'actor-org-epoch') }));
vi.mock('react-i18next', async () => {
  const en = (await import('@/i18n/locales/en')).default;
  return {
    useTranslation: () => ({
      t: (key: string, values: Record<string, unknown> = {}) => {
        const group = key.startsWith('aiConnections.') ? en.aiConnections : en.nav;
        const text = Object.entries(group).find(([name]) => name === key.split('.')[1])?.[1] ?? key;
        return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
      },
    }),
  };
});
const click = (element: Element) =>
  act(async () => {
    userEvent.click(element);
  });
const keyboard = (text: string) =>
  act(async () => {
    userEvent.keyboard(text);
  });
const request: ConsentRequest = {
  ticket: 'a'.repeat(64),
  clientName: 'Test AI',
  clientId: 'test-ai',
  organization: { id: 1, name: 'Current org' },
  accountLabel: 'user@example.test',
  requestedScopes: ['sources:read', 'documents:read'],
  expiresAt: '2099-10-29T01:00:00.000Z',
  reviewToken: 'signed-review',
  redirectUri: 'https://ai.example/callback',
};
const list: AiConnectionList = {
  configured: true,
  resourceUrl: 'https://api.example/v1/mcp',
  organization: request.organization,
  connections: [
    {
      id: 'grant-id',
      clientName: request.clientName,
      clientId: request.clientId,
      organizationId: 1,
      scopes: request.requestedScopes,
      createdAt: '2026-10-29T00:00:00.000Z',
      expiresAt: request.expiresAt,
      revoked: false,
    },
  ],
};
function showConsent() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/ai-connections/approve/' + request.ticket]}>
        <Routes>
          <Route path="/ai-connections/approve/:ticket" element={<Approve />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}
function showList() {
  return render(
    <MemoryRouter>
      <AiConnections />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(personalLibrarySessionScope).mockReturnValue('actor-org-epoch');
  vi.mocked(aiConnectionsService.request).mockResolvedValue(request);
  vi.mocked(aiConnectionsService.list).mockResolvedValue(list);
  vi.mocked(aiConnectionsService.decide).mockImplementation(() => new Promise(() => undefined));
  vi.mocked(aiConnectionsService.disconnect).mockResolvedValue(undefined);
});
afterEach(() => cleanup());
it('reviews account, callback and one current organization without auto approval', async () => {
  showConsent();
  await screen.findByRole('heading', { name: 'Connect Test AI' });
  expect(screen.getByText(request.accountLabel)).toBeTruthy();
  expect(screen.getByText(request.redirectUri)).toBeTruthy();
  const org = screen.getByRole('combobox', { name: 'Current organization' });
  expect(org.hasAttribute('disabled')).toBe(true);
  expect(within(org).getAllByRole('option')).toHaveLength(1);
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  expect(aiConnectionsService.decide).not.toHaveBeenCalled();
});
it('keyboard selects a subset and submits only once', async () => {
  showConsent();
  const checkbox = await screen.findByRole('checkbox', { name: 'Read saved document content' });
  act(() => checkbox.focus());
  await keyboard(' ');
  const approve = screen.getByRole('button', { name: 'Approve connection' });
  await click(approve);
  fireEvent.click(approve);
  expect(aiConnectionsService.decide).toHaveBeenCalledTimes(1);
  expect(aiConnectionsService.decide).toHaveBeenCalledWith(request, { decision: 'approve', scopes: ['sources:read'] });
  expect((await screen.findByRole('status')).textContent).toBe('Submitting…');
});
it('empty selection disables approval and cancellation sends no scopes', async () => {
  showConsent();
  await click(await screen.findByRole('checkbox', { name: 'Read source schemas and descriptions' }));
  await click(screen.getByRole('checkbox', { name: 'Read saved document content' }));
  expect(screen.getByRole('button', { name: 'Approve connection' }).hasAttribute('disabled')).toBe(true);
  await click(screen.getByRole('button', { name: 'Cancel request' }));
  expect(aiConnectionsService.decide).toHaveBeenCalledWith(request, { decision: 'cancel', scopes: [] });
});
it('failed decision ends the attempt and offers connections', async () => {
  vi.mocked(aiConnectionsService.decide).mockRejectedValue(new Error('lost response'));
  showConsent();
  await click(await screen.findByRole('button', { name: 'Approve connection' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Approve connection' })).toBeNull();
  expect(screen.getByRole('link', { name: 'View connections' }).getAttribute('href')).toBe('/ai-connections');
  expect(aiConnectionsService.decide).toHaveBeenCalledTimes(1);
});
it('reload reads only and expired requests cannot submit', async () => {
  const view = showConsent();
  await screen.findByRole('button', { name: 'Approve connection' });
  view.unmount();
  vi.mocked(aiConnectionsService.request).mockResolvedValue({ ...request, expiresAt: '2000-01-01T00:00:00.000Z' });
  showConsent();
  expect((await screen.findByRole('button', { name: 'Approve connection' })).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Cancel request' }).hasAttribute('disabled')).toBe(true);
  expect(aiConnectionsService.decide).not.toHaveBeenCalled();
});
it('late responses from an old actor never become actionable', async () => {
  let finish: (value: ConsentRequest) => void = () => undefined;
  vi.mocked(aiConnectionsService.request).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  showConsent();
  vi.mocked(personalLibrarySessionScope).mockReturnValue('another-actor');
  await act(async () => {
    finish(request);
  });
  expect(screen.queryByRole('button', { name: 'Approve connection' })).toBeNull();
});
it('old actor button cannot post after the session changes', async () => {
  showConsent();
  const approve = await screen.findByRole('button', { name: 'Approve connection' });
  vi.mocked(personalLibrarySessionScope).mockReturnValue('another-actor');
  await click(approve);
  expect(aiConnectionsService.decide).not.toHaveBeenCalled();
});
it('configuration missing and no organization are explicit', async () => {
  vi.mocked(aiConnectionsService.list).mockResolvedValue({
    configured: false,
    resourceUrl: null,
    organization: null,
    connections: [],
  });
  showList();
  await screen.findByText('No external AI connections in this organization.');
  expect(
    screen.getByText('External AI connections are not configured. Ask your administrator to configure an approved client.'),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
});
it('list reload shows read scopes and never disconnects', async () => {
  showList();
  await screen.findByText('Test AI');
  expect(screen.getByText('Read saved document content')).toBeTruthy();
  await click(screen.getByRole('button', { name: 'Reload list' }));
  await screen.findByText('Test AI');
  expect(aiConnectionsService.list).toHaveBeenCalledTimes(2);
  expect(aiConnectionsService.disconnect).not.toHaveBeenCalled();
});
it('dialog focuses keep, traps keyboard and returns focus after Escape', async () => {
  showList();
  const trigger = await screen.findByRole('button', { name: 'Disconnect' });
  await click(trigger);
  const dialog = screen.getByRole('dialog');
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Keep connection' })));
  await act(async () => {
    userEvent.tab();
  });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(aiConnectionsService.disconnect).not.toHaveBeenCalled();
});
it('requires a separate disconnect confirmation and displays revoked status', async () => {
  showList();
  await click(await screen.findByRole('button', { name: 'Disconnect' }));
  expect(aiConnectionsService.disconnect).not.toHaveBeenCalled();
  await click(screen.getByRole('button', { name: 'Confirm disconnect' }));
  await screen.findByText('Disconnected');
  expect(aiConnectionsService.disconnect).toHaveBeenCalledWith('grant-id');
  expect(screen.getByRole('button', { name: 'Disconnect' }).hasAttribute('disabled')).toBe(true);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reload list' })));
});
it('disconnect failure prevents repeat until list reload', async () => {
  vi.mocked(aiConnectionsService.disconnect).mockRejectedValue(new Error('lost response'));
  showList();
  await click(await screen.findByRole('button', { name: 'Disconnect' }));
  await click(screen.getByRole('button', { name: 'Confirm disconnect' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Confirm disconnect' }).hasAttribute('disabled')).toBe(true);
  await click(screen.getByRole('button', { name: 'Keep connection' }));
  await click(screen.getByRole('button', { name: 'Reload list' }));
  await screen.findByRole('button', { name: 'Disconnect' });
  expect(aiConnectionsService.disconnect).toHaveBeenCalledTimes(1);
});
it('load error clears list and reload is read only', async () => {
  vi.mocked(aiConnectionsService.list).mockRejectedValueOnce(new Error('network'));
  showList();
  await screen.findByRole('alert');
  expect(screen.queryByText('Test AI')).toBeNull();
  await click(screen.getByRole('button', { name: 'Reload list' }));
  await screen.findByText('Test AI');
  expect(aiConnectionsService.disconnect).not.toHaveBeenCalled();
});

it('session change clears management data before a late list response', async () => {
  let finish: (value: AiConnectionList) => void = () => undefined;
  vi.mocked(aiConnectionsService.list).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  showList();
  vi.mocked(personalLibrarySessionScope).mockReturnValue('new-session');
  await act(async () => {
    finish(list);
  });
  expect(screen.queryByText('Test AI')).toBeNull();
  expect(aiConnectionsService.disconnect).not.toHaveBeenCalled();
});
