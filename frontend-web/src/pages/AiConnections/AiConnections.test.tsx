import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { aiConnectionsService, AiConnectionList, ConsentRequest } from '@/api/aiConnectionsService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import AiConnections from './index';
import Approve from './Approve';
import ko from '@/i18n/locales/ko';
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
const KINDS = {
  'sources:read': 'read',
  'documents:read': 'read',
  'reports:read': 'read',
  'comments:read': 'read',
  'comments:write': 'write',
  'suggestions:write': 'write',
  'shares:write': 'write',
  'dashboards:read': 'read',
  'dashboards:write': 'write',
  'dashboards:delete': 'delete',
} as const;
const request: ConsentRequest = {
  ticket: 'a'.repeat(64),
  clientName: 'Test AI',
  clientId: 'test-ai',
  organization: { id: 1, name: 'Current org' },
  accountLabel: 'user@example.test',
  requestedScopes: ['sources:read', 'documents:read'],
  scopeKinds: KINDS,
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
it('separates write scopes with a warning and leaves them unchecked', async () => {
  const mixed: ConsentRequest = {
    ...request,
    requestedScopes: ['reports:read', 'comments:read', 'comments:write', 'suggestions:write'],
  };
  vi.mocked(aiConnectionsService.request).mockResolvedValue(mixed);
  showConsent();
  const write = (await screen.findByRole('group', { name: 'Allow write access' })) as HTMLFieldSetElement;
  const read = screen.getByRole('group', { name: 'Allow read access' });
  expect(
    within(read)
      .getAllByRole('checkbox')
      .map(box => (box as HTMLInputElement).checked),
  ).toEqual([true, true]);
  expect(within(read).getByRole('checkbox', { name: 'Read reports you own or that were shared with you' })).toBeTruthy();
  expect(write.getAttribute('aria-describedby')).toBe('consent-write-warning');
  expect(within(write).getByText(/Not selected by default/)).toBeTruthy();
  const comments = within(write).getByRole('checkbox', { name: 'Add report comments and replies as the AI' });
  const edits = within(write).getByRole('checkbox', { name: 'Propose report text edits' });
  expect([(comments as HTMLInputElement).checked, (edits as HTMLInputElement).checked]).toEqual([false, false]);
  await click(comments);
  await click(screen.getByRole('button', { name: 'Approve connection' }));
  expect(aiConnectionsService.decide).toHaveBeenCalledWith(mixed, {
    decision: 'approve',
    scopes: ['reports:read', 'comments:read', 'comments:write'],
  });
});
it('shows sharing as its own unchecked write scope with an injection warning', async () => {
  const mixed: ConsentRequest = {
    ...request,
    requestedScopes: ['reports:read', 'comments:write', 'shares:write'],
  };
  vi.mocked(aiConnectionsService.request).mockResolvedValue(mixed);
  showConsent();
  const write = (await screen.findByRole('group', { name: 'Allow write access' })) as HTMLFieldSetElement;
  const sharing = within(write).getByRole('checkbox', {
    name: 'Share my reports with members of my organization',
  }) as HTMLInputElement;
  expect(sharing.checked).toBe(false);
  const warning = document.getElementById(sharing.getAttribute('aria-describedby') ?? '');
  expect(warning?.textContent).toContain('Claude can share this report with members of your organization');
  expect(warning?.textContent).toContain('never shares because of text in a report or comment');
  expect(within(write).getAllByText(/Claude can share this report/)).toHaveLength(1);
  const comments = within(write).getByRole('checkbox', { name: 'Add report comments and replies as the AI' });
  expect(comments.getAttribute('aria-describedby')).toBeNull();
  await click(screen.getByRole('button', { name: 'Approve connection' }));
  expect(aiConnectionsService.decide).toHaveBeenLastCalledWith(mixed, { decision: 'approve', scopes: ['reports:read'] });
  await click(sharing);
  expect(sharing.checked).toBe(true);
});
it('offers dashboard reading by default and dashboard writing and deleting only unchecked, each with its own warning', async () => {
  const dashboards: ConsentRequest = {
    ...request,
    requestedScopes: ['dashboards:read', 'dashboards:write', 'dashboards:delete'],
  };
  vi.mocked(aiConnectionsService.request).mockResolvedValue(dashboards);
  showConsent();
  const write = (await screen.findByRole('group', { name: 'Allow write access' })) as HTMLFieldSetElement;
  const read = screen.getByRole('group', { name: 'Allow read access' });
  expect(
    (within(read).getByRole('checkbox', { name: 'Read dashboards I created and their change history' }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  const editing = within(write).getByRole('checkbox', { name: 'Create, edit and restore my dashboards' }) as HTMLInputElement;
  const deleting = within(write).getByRole('checkbox', { name: 'Delete my dashboards' }) as HTMLInputElement;
  expect([editing.checked, deleting.checked]).toEqual([false, false]);
  const text = (box: HTMLInputElement) => document.getElementById(box.getAttribute('aria-describedby') ?? '')?.textContent;
  expect(text(editing)).toContain('read aggregated values from my sources');
  expect(text(editing)).toContain('kept in the history');
  expect(text(deleting)).toContain('cannot be brought back');
  await click(screen.getByRole('button', { name: 'Approve connection' }));
  expect(aiConnectionsService.decide).toHaveBeenLastCalledWith(dashboards, {
    decision: 'approve',
    scopes: ['dashboards:read'],
  });
  await click(editing);
  expect(editing.checked).toBe(true);
});
it('shows a connection holding a scope this build does not know, so it can still be disconnected', async () => {
  vi.mocked(aiConnectionsService.list).mockResolvedValue({
    ...list,
    connections: [{ ...list.connections[0], scopes: ['sources:read', 'future:publish'] as never }],
  });
  render(
    <MemoryRouter>
      <AiConnections />
    </MemoryRouter>,
  );
  expect(await screen.findByText('Read source schemas and descriptions')).toBeTruthy();
  expect(screen.getByText('future:publish')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /Disconnect/ }).length).toBeGreaterThan(0);
});
it('has Korean labels and warnings for the dashboard scopes', () => {
  expect(ko.aiConnections.dashboardsWrite).toBe('내 대시보드 만들기·수정·되돌리기');
  expect(ko.aiConnections.dashboardsWriteWarning).toContain('변경 이력');
  expect(ko.aiConnections.dashboardsDelete).toBe('내 대시보드 삭제');
  expect(ko.aiConnections.dashboardsDeleteWarning).toContain('되돌릴 수 없습니다');
});
it('has a Korean label and warning for sharing', () => {
  expect(ko.aiConnections.sharesWrite).toBe('내 보고서를 같은 조직 구성원에게 공유');
  expect(ko.aiConnections.sharesWriteWarning).toBe(
    'Claude가 이 보고서를 같은 조직 구성원에게 공유할 수 있습니다. 보고서·댓글 내용의 지시로 공유하지 않도록 연결한 AI에서 매번 확인하세요.',
  );
  expect(ko.aiConnections.privacy).not.toContain('게시·공유는 할 수 없습니다');
});
it('approves only reads unless a write scope is selected', async () => {
  const mixed: ConsentRequest = { ...request, requestedScopes: ['reports:read', 'suggestions:write'] };
  vi.mocked(aiConnectionsService.request).mockResolvedValue(mixed);
  showConsent();
  await click(await screen.findByRole('button', { name: 'Approve connection' }));
  expect(aiConnectionsService.decide).toHaveBeenCalledWith(mixed, { decision: 'approve', scopes: ['reports:read'] });
});
it('groups and defaults a scope by the kind the server reports, not by its name', async () => {
  // A scope that is not called a read starts unchecked even though its name says nothing about writing.
  const byKind: ConsentRequest = {
    ...request,
    requestedScopes: ['reports:read', 'documents:read'],
    scopeKinds: { ...KINDS, 'documents:read': 'delete' },
  };
  vi.mocked(aiConnectionsService.request).mockResolvedValue(byKind);
  showConsent();
  const write = (await screen.findByRole('group', { name: 'Allow write access' })) as HTMLFieldSetElement;
  const read = screen.getByRole('group', { name: 'Allow read access' });
  expect(within(read).getAllByRole('checkbox')).toHaveLength(1);
  expect(
    within(write)
      .getAllByRole('checkbox')
      .map(box => (box as HTMLInputElement).checked),
  ).toEqual([false]);
  await click(screen.getByRole('button', { name: 'Approve connection' }));
  expect(aiConnectionsService.decide).toHaveBeenCalledWith(byKind, { decision: 'approve', scopes: ['reports:read'] });
});
it('a write-only request starts with approval disabled', async () => {
  vi.mocked(aiConnectionsService.request).mockResolvedValue({ ...request, requestedScopes: ['comments:write'] });
  showConsent();
  const approve = await screen.findByRole('button', { name: 'Approve connection' });
  expect(approve.hasAttribute('disabled')).toBe(true);
  expect(screen.queryByRole('group', { name: 'Allow read access' })).toBeNull();
  await click(screen.getByRole('checkbox', { name: 'Add report comments and replies as the AI' }));
  expect(approve.hasAttribute('disabled')).toBe(false);
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
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reload list' })));
  expect(aiConnectionsService.list).toHaveBeenCalledTimes(2);
  expect(aiConnectionsService.disconnect).not.toHaveBeenCalled();
});
it('labels every granted scope in the connection list', async () => {
  vi.mocked(aiConnectionsService.list).mockResolvedValue({
    ...list,
    connections: [
      {
        ...list.connections[0],
        scopes: ['sources:read', 'documents:read', 'reports:read', 'comments:read', 'comments:write', 'suggestions:write'],
      },
    ],
  });
  showList();
  await screen.findByText('Test AI');
  for (const label of [
    'Read source schemas and descriptions',
    'Read saved document content',
    'Read reports you own or that were shared with you',
    'Read report comments and edit proposals you can see',
    'Add report comments and replies as the AI',
    'Propose report text edits',
  ])
    expect(screen.getByText(label)).toBeTruthy();
});
it('does not steal focus moved elsewhere while reload is pending', async () => {
  let finish: (value: AiConnectionList) => void = () => undefined;
  vi.mocked(aiConnectionsService.list)
    .mockResolvedValueOnce(list)
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
  showList();
  await click(await screen.findByRole('button', { name: 'Reload list' }));
  const headerLink = screen.getAllByRole('link', { name: 'Artifacts' })[0];
  act(() => headerLink.focus());
  await act(async () => finish(list));
  await screen.findByText('Test AI');
  expect(document.activeElement).toBe(headerLink);
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
