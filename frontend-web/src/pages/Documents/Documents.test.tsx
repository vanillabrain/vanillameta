import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { documentService, DocumentDetail as Detail } from '@/api/documentService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import Documents from './index';
import DocumentDetail from './DocumentDetail';
import GoogleCallback from './GoogleCallback';
import { recoveryKey } from './refreshRecovery';

vi.mock('@/api/documentService', () => ({
  documentService: {
    list: vi.fn(),
    detail: vi.fn(),
    snapshot: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    refresh: vi.fn(),
    request: vi.fn(),
    disconnect: vi.fn(),
  },
}));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: vi.fn(() => 'actor-org-epoch') }));
vi.mock('react-i18next', async () => {
  const en = (await import('@/i18n/locales/en')).default;
  return {
    useTranslation: () => ({
      t: (key: string, values: Record<string, unknown> = {}) => {
        const group = key.startsWith('docConnection.') ? en.docConnection : en.nav;
        const text = Object.entries(group).find(([name]) => name === key.split('.')[1])?.[1] ?? key;
        return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
      },
    }),
  };
});
const user = {
  click: (element: Element) =>
    act(async () => {
      userEvent.click(element);
    }),
  tab: (options?: Parameters<typeof userEvent.tab>[0]) =>
    act(async () => {
      userEvent.tab(options);
    }),
  keyboard: (text: string) =>
    act(async () => {
      userEvent.keyboard(text);
    }),
};
const id = 'c409a190-a727-4e65-8d9f-a2bc013966fd';
const date = '2026-10-29T00:00:00.000Z';
const version = {
  version: 1,
  sourceVersion: '10',
  sourceModifiedAt: date,
  capturedAt: date,
  sha256: 'a'.repeat(64),
  byteSize: 30,
};
const detail: Detail = {
  id,
  title: 'Quarterly plan',
  sourceUrl: 'https://docs.google.com/document/d/abcdefghij12345/edit',
  currentVersion: 1,
  connected: true,
  updatedAt: date,
  versions: [version],
  snapshot: { ...version, markdown: '<script>bad()</script> ![remote](https://evil.test/image.png)' },
};
const list = { configured: true, organizationId: 1, documents: [detail] };
function showDetail() {
  return render(
    <MemoryRouter initialEntries={[`/documents/${id}`]}>
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.mocked(personalLibrarySessionScope).mockReturnValue('actor-org-epoch');
  vi.mocked(documentService.list).mockResolvedValue(list);
  vi.mocked(documentService.detail).mockResolvedValue(detail);
  vi.mocked(documentService.snapshot).mockResolvedValue(detail.snapshot);
  sessionStorage.clear();
  window.history.replaceState(null, '', '/documents');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('lists private stored copies and preserves artifact return context', async () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/documents?artifactReturn=' +
          encodeURIComponent(
            JSON.stringify({ version: 1, query: 'sales', kind: 'all', sort: 'recent', display: 'list', view: 'active' }),
          ),
      ]}
    >
      <Documents />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('link', { name: 'Quarterly plan' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Artifacts' }).getAttribute('href')).toContain('artifactQuery=sales');
  expect(documentService.refresh).not.toHaveBeenCalled();
});
it('handles empty/no membership and configuration without enabling connect', async () => {
  vi.mocked(documentService.list).mockResolvedValue({ configured: false, organizationId: null, documents: [] });
  render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>,
  );
  await screen.findByText('No documents connected yet.');
  expect(screen.getByRole('button', { name: 'Connect Google document' }).hasAttribute('disabled')).toBe(true);
});
it('allows explicit reload after list failure', async () => {
  vi.mocked(documentService.list).mockRejectedValueOnce(new Error('offline'));
  render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>,
  );
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Reload' }));
  await screen.findByRole('link', { name: 'Quarterly plan' });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Google documents' })));
});
it('does not steal focus moved elsewhere while document reload is pending', async () => {
  let finish: (value: typeof list) => void = () => undefined;
  vi.mocked(documentService.list)
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
  render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: 'Reload' }));
  const headerLink = screen.getAllByRole('link', { name: 'Artifacts' })[0];
  act(() => headerLink.focus());
  await act(async () => finish(list));
  await screen.findByRole('link', { name: 'Quarterly plan' });
  expect(document.activeElement).toBe(headerLink);
});
it('returns focus to retry when the explicit document reload fails again', async () => {
  vi.mocked(documentService.list).mockRejectedValue(new Error('offline'));
  render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>,
  );
  const retry = await screen.findByRole('button', { name: 'Reload' });
  await user.click(retry);
  await screen.findByRole('alert');
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reload' })));
});
it('uses Radix keyboard focus trapping, Escape and trigger focus return for consent', async () => {
  render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>,
  );
  const trigger = await screen.findByRole('button', { name: 'Connect Google document' });
  await user.click(trigger);
  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByRole('textbox', { name: 'Original Google Docs URL' });
  await waitFor(() => expect(document.activeElement).toBe(input));
  await user.tab();
  expect(document.activeElement).toBe(within(dialog).getByRole('checkbox'));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(input);
  for (let turn = 0; turn < 9; turn++) {
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  }
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(documentService.start).not.toHaveBeenCalled();
});
it('requires explicit consent and shows safe start errors without redirect or automatic retry', async () => {
  vi.mocked(documentService.start).mockRejectedValue(new Error('Invalid authorization URL'));
  render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: 'Connect Google document' }));
  const proceed = screen.getByRole('button', { name: 'Continue to Google' });
  expect(proceed.hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: detail.sourceUrl } });
  await user.click(screen.getByRole('checkbox'));
  await user.click(proceed);
  await screen.findByRole('alert');
  expect(documentService.start).toHaveBeenCalledExactlyOnceWith({ sourceUrl: detail.sourceUrl });
  expect(proceed.hasAttribute('disabled')).toBe(true);
});
it('renders escaped Markdown without external images or HTML, and reads historical versions', async () => {
  vi.mocked(documentService.detail).mockResolvedValue({
    ...detail,
    versions: [{ ...version, version: 2 }, version],
    currentVersion: 2,
  });
  showDetail();
  const markdown = await screen.findByLabelText('Stored Markdown text');
  expect(markdown.textContent).toContain('<script>');
  expect(markdown.querySelector('script,img,a')).toBeNull();
  fireEvent.change(screen.getByLabelText('Stored version'), { target: { value: '1' } });
  await waitFor(() => expect(documentService.snapshot).toHaveBeenCalledWith(id, 1));
  await screen.findByLabelText('Stored Markdown text');
  expect(documentService.refresh).not.toHaveBeenCalled();
});
it('imports only after a button press and uses expected version zero', async () => {
  vi.mocked(documentService.detail).mockResolvedValue({ ...detail, currentVersion: 0, versions: [], snapshot: null });
  vi.mocked(documentService.refresh).mockResolvedValue({ documentId: id, version: 1, unchanged: false });
  showDetail();
  const button = await screen.findByRole('button', { name: 'Import stored copy' });
  expect(documentService.refresh).not.toHaveBeenCalled();
  await user.click(button);
  await screen.findByText('Stored version 1 saved.');
  expect(documentService.refresh).toHaveBeenCalledExactlyOnceWith(id, { requestId: expect.any(String), expectedVersion: 0 });
});
it('preserves the request after error and recovers a completed receipt using GET only', async () => {
  vi.mocked(documentService.refresh).mockRejectedValue(new Error('lost response'));
  vi.mocked(documentService.request).mockResolvedValue({
    status: 'completed',
    result: { documentId: id, version: 2, unchanged: false },
  });
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
  await screen.findByRole('button', { name: 'Look up result' });
  const sent = vi.mocked(documentService.refresh).mock.calls[0][1];
  expect(JSON.parse(sessionStorage.getItem(recoveryKey('actor-org-epoch', id)))).toEqual(sent);
  await user.click(screen.getByRole('button', { name: 'Look up result' }));
  await screen.findByText('Stored version 2 saved.');
  expect(documentService.request).toHaveBeenCalledExactlyOnceWith(id, sent.requestId);
  expect(documentService.refresh).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(recoveryKey('actor-org-epoch', id))).toBeNull();
});
it('requires failed outcome and separate confirmation before starting a new request', async () => {
  vi.mocked(documentService.refresh).mockRejectedValue(new Error('failure'));
  vi.mocked(documentService.request).mockResolvedValue({ status: 'failed' });
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
  await user.click(await screen.findByRole('button', { name: 'Look up result' }));
  await user.click(await screen.findByRole('button', { name: 'Review a new attempt' }));
  expect(documentService.refresh).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Confirm attempt' }));
  await waitFor(() => expect(documentService.refresh).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(documentService.refresh).mock.calls;
  expect(calls[0][1].requestId).not.toBe(calls[1][1].requestId);
});
it('reload preserves the pending UUID without issuing a write or automatic result lookup', async () => {
  const pending = { requestId: '1f7f988b-8011-4293-9bda-dba12b18b7b2', expectedVersion: 1 };
  sessionStorage.setItem(recoveryKey('actor-org-epoch', id), JSON.stringify(pending));
  showDetail();
  await screen.findByRole('button', { name: 'Refresh stored copy' });
  expect(screen.getByRole('button', { name: 'Refresh stored copy' }).hasAttribute('disabled')).toBe(true);
  expect(documentService.refresh).not.toHaveBeenCalled();
  expect(documentService.request).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Review a new attempt' })).toBeNull();
});
it('keeps independent stored copies readable after disconnect, and pins reconnect to the same document', async () => {
  vi.mocked(documentService.detail).mockResolvedValue({ ...detail, connected: false });
  vi.mocked(documentService.start).mockRejectedValue(new Error('offline'));
  showDetail();
  await screen.findByLabelText('Stored Markdown text');
  expect(screen.getByRole('button', { name: 'Refresh stored copy' }).hasAttribute('disabled')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Reconnect same document' }));
  expect(screen.getByRole('textbox').hasAttribute('readonly')).toBe(true);
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Continue to Google' }));
  await waitFor(() =>
    expect(documentService.start).toHaveBeenCalledExactlyOnceWith({ sourceUrl: detail.sourceUrl, documentId: id }),
  );
});
it('disconnect requires confirmation and does not remove stored copies', async () => {
  vi.mocked(documentService.disconnect).mockResolvedValue();
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Disconnect original' }));
  expect(documentService.disconnect).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm disconnect' }));
  await waitFor(() => expect(documentService.disconnect).toHaveBeenCalledExactlyOnceWith(id));
  await screen.findByLabelText('Stored Markdown text');
});
it('scrubs callback URL before its one StrictMode POST and navigates to the result', async () => {
  window.history.replaceState(
    null,
    '',
    '/documents/google/callback?state=private-state&code=private-code&picked_file_ids=abcdefghij12345',
  );
  vi.mocked(documentService.complete).mockImplementation(async () => {
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    return id;
  });
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/documents/google/callback']}>
        <Routes>
          <Route path="/documents/google/callback" element={<GoogleCallback />} />
          <Route path="/documents/:id" element={<div>Connection complete</div>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
  await screen.findByText('Connection complete');
  expect(documentService.complete).toHaveBeenCalledExactlyOnceWith({
    state: 'private-state',
    code: 'private-code',
    pickedFileIds: 'abcdefghij12345',
  });
  expect(sessionStorage.length).toBe(0);
});
it.each([
  '?error=access_denied&code=secret',
  '?state=one&state=two&code=secret&picked_file_ids=file',
  '?state=one&code=secret',
])('returns safely on invalid or cancelled callback %s', async query => {
  window.history.replaceState(null, '', '/documents/google/callback' + query);
  render(
    <MemoryRouter>
      <GoogleCallback />
    </MemoryRouter>,
  );
  await screen.findByRole('alert');
  expect(window.location.search).toBe('');
  expect(documentService.complete).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Return to documents' }).getAttribute('href')).toBe('/documents');
});
it('callback failure offers return without automatic POST retry', async () => {
  window.history.replaceState(
    null,
    '',
    '/documents/google/callback?state=private-state&code=private-code&picked_file_ids=file',
  );
  vi.mocked(documentService.complete).mockRejectedValue(new Error('private-code'));
  render(
    <StrictMode>
      <MemoryRouter>
        <GoogleCallback />
      </MemoryRouter>
    </StrictMode>,
  );
  await screen.findByRole('alert');
  expect(documentService.complete).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('private-code')).toBeNull();
});

it('keeps the exact same request and version for an explicitly confirmed missing-request retry', async () => {
  vi.mocked(documentService.refresh).mockRejectedValue(new Error('lost'));
  vi.mocked(documentService.request).mockResolvedValue({ status: 'missing' });
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
  await user.click(await screen.findByRole('button', { name: 'Look up result' }));
  expect(screen.queryByRole('button', { name: 'Review a new attempt' })).toBeNull();
  await user.click(await screen.findByRole('button', { name: 'Review same-request retry' }));
  await user.click(screen.getByRole('button', { name: 'Confirm attempt' }));
  await waitFor(() => expect(documentService.refresh).toHaveBeenCalledTimes(2));
  expect(vi.mocked(documentService.refresh).mock.calls[1]).toEqual(vi.mocked(documentService.refresh).mock.calls[0]);
});

it('preserves a pending request on result lookup error and offers no new write', async () => {
  vi.mocked(documentService.refresh).mockRejectedValue(new Error('lost'));
  vi.mocked(documentService.request).mockRejectedValue(new Error('unavailable'));
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
  await user.click(await screen.findByRole('button', { name: 'Look up result' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(documentService.refresh).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(recoveryKey('actor-org-epoch', id))).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Review a new attempt' })).toBeNull();
});

it('discards a delayed refresh result after the actor scope changes', async () => {
  const response = Promise.withResolvers<Awaited<ReturnType<typeof documentService.refresh>>>();
  vi.mocked(documentService.refresh).mockReturnValue(response.promise);
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
  vi.mocked(personalLibrarySessionScope).mockReturnValue(null);
  fireEvent(window, new StorageEvent('storage', { key: 'accessToken' }));
  await act(async () => {
    response.resolve({ documentId: id, version: 2, unchanged: false });
  });
  expect(screen.queryByText('Stored version 2 saved.')).toBeNull();
  expect(sessionStorage.getItem(recoveryKey('actor-org-epoch', id))).not.toBeNull();
});

it('discards a delayed snapshot read when the original actor scope is gone', async () => {
  const response = Promise.withResolvers<Awaited<ReturnType<typeof documentService.snapshot>>>();
  vi.mocked(documentService.snapshot).mockReturnValue(response.promise);
  showDetail();
  await screen.findByLabelText('Stored Markdown text');
  fireEvent.change(screen.getByLabelText('Stored version'), { target: { value: '1' } });
  vi.mocked(personalLibrarySessionScope).mockReturnValue('different-actor');
  await act(async () => {
    response.resolve({ ...version, markdown: 'Late private bytes' });
  });
  expect(screen.queryByText('Late private bytes')).toBeNull();
});

it('ignores an authorization response after consent dialog cancellation', async () => {
  const response = Promise.withResolvers<string>();
  vi.mocked(documentService.start).mockReturnValue(response.promise);
  render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: 'Connect Google document' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: detail.sourceUrl } });
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Continue to Google' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  const assign = vi.fn();
  vi.stubGlobal('location', { assign });
  await act(async () => {
    response.resolve('https://accounts.google.com/o/oauth2/v2/auth');
  });
  expect(assign).not.toHaveBeenCalled();
});

it('does not navigate a callback result into a changed actor session', async () => {
  window.history.replaceState(
    null,
    '',
    '/documents/google/callback?state=private-state&code=private-code&picked_file_ids=file',
  );
  const response = Promise.withResolvers<string>();
  vi.mocked(documentService.complete).mockReturnValue(response.promise);
  render(
    <StrictMode>
      <MemoryRouter>
        <GoogleCallback />
      </MemoryRouter>
    </StrictMode>,
  );
  vi.mocked(personalLibrarySessionScope).mockReturnValue('different-actor');
  await act(async () => {
    response.resolve(id);
  });
  await screen.findByRole('alert');
  expect(documentService.complete).toHaveBeenCalledTimes(1);
});

it.each(['failed', 'missing'] as const)(
  'reconciles a %s ticket against the newer two-tab basis only after confirmation',
  async status => {
    vi.mocked(documentService.refresh).mockRejectedValue(new Error('stale two-tab basis'));
    vi.mocked(documentService.request).mockResolvedValue({ status });
    showDetail();
    await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
    const original = vi.mocked(documentService.refresh).mock.calls[0][1];
    const latest = { ...detail, currentVersion: 2, versions: [{ ...version, version: 2 }, version] };
    vi.mocked(documentService.detail).mockResolvedValue(latest);
    vi.mocked(documentService.list).mockResolvedValue({ ...list, documents: [latest] });
    await user.click(await screen.findByRole('button', { name: 'Look up result' }));
    await waitFor(() => expect(documentService.detail).toHaveBeenCalledTimes(2));
    expect(documentService.list).toHaveBeenCalledTimes(2);
    const review = await screen.findByRole('button', { name: 'Review a new attempt' });
    await waitFor(() => expect(review.hasAttribute('disabled')).toBe(false));
    expect(JSON.parse(sessionStorage.getItem(recoveryKey('actor-org-epoch', id)))).toEqual(original);
    expect(documentService.refresh).toHaveBeenCalledTimes(1);
    await user.click(review);
    expect(documentService.refresh).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Confirm attempt' }));
    await waitFor(() => expect(documentService.refresh).toHaveBeenCalledTimes(2));
    const next = vi.mocked(documentService.refresh).mock.calls[1][1];
    expect(next.expectedVersion).toBe(2);
    expect(next.requestId).not.toBe(original.requestId);
  },
);

it.each(['failed', 'missing'] as const)(
  'allows reconnect after a %s receipt discovers a disconnect in another tab and retains the ticket',
  async status => {
    vi.mocked(documentService.refresh).mockRejectedValue(new Error('disconnected elsewhere'));
    vi.mocked(documentService.request).mockResolvedValue({ status });
    vi.mocked(documentService.start).mockRejectedValue(new Error('offline'));
    showDetail();
    await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
    const original = vi.mocked(documentService.refresh).mock.calls[0][1];
    vi.mocked(documentService.detail).mockResolvedValue({ ...detail, connected: false });
    await user.click(await screen.findByRole('button', { name: 'Look up result' }));
    const reconnect = await screen.findByRole('button', { name: 'Reconnect same document' });
    expect(reconnect.hasAttribute('disabled')).toBe(false);
    expect(
      screen
        .getByRole('button', { name: status === 'failed' ? 'Review a new attempt' : 'Review same-request retry' })
        .hasAttribute('disabled'),
    ).toBe(true);
    await user.click(reconnect);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Continue to Google' }));
    await waitFor(() =>
      expect(documentService.start).toHaveBeenCalledExactlyOnceWith({ sourceUrl: detail.sourceUrl, documentId: id }),
    );
    expect(JSON.parse(sessionStorage.getItem(recoveryKey('actor-org-epoch', id)))).toEqual(original);
    expect(documentService.refresh).toHaveBeenCalledTimes(1);
  },
);

it('allows explicit disconnect for credential repair after a failed receipt without clearing the ticket', async () => {
  vi.mocked(documentService.refresh).mockRejectedValue(new Error('expired credentials'));
  vi.mocked(documentService.request).mockResolvedValue({ status: 'failed' });
  vi.mocked(documentService.disconnect).mockResolvedValue();
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
  const original = vi.mocked(documentService.refresh).mock.calls[0][1];
  await user.click(await screen.findByRole('button', { name: 'Look up result' }));
  const disconnect = await screen.findByRole('button', { name: 'Disconnect original' });
  await waitFor(() => expect(disconnect.hasAttribute('disabled')).toBe(false));
  await user.click(disconnect);
  expect(documentService.disconnect).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm disconnect' }));
  await waitFor(() => expect(documentService.disconnect).toHaveBeenCalledExactlyOnceWith(id));
  expect(JSON.parse(sessionStorage.getItem(recoveryKey('actor-org-epoch', id)))).toEqual(original);
  expect(documentService.refresh).toHaveBeenCalledTimes(1);
});

it('does not replace a missing ticket when the current version is lower than its expected version', async () => {
  const pending = { requestId: '1f7f988b-8011-4293-9bda-dba12b18b7b2', expectedVersion: 2 };
  sessionStorage.setItem(recoveryKey('actor-org-epoch', id), JSON.stringify(pending));
  vi.mocked(documentService.request).mockResolvedValue({ status: 'missing' });
  showDetail();
  await screen.findByLabelText('Stored Markdown text');
  await user.click(screen.getByRole('button', { name: 'Look up result' }));
  await waitFor(() => expect(documentService.detail).toHaveBeenCalledTimes(2));
  await screen.findByLabelText('Stored Markdown text');
  expect(screen.queryByRole('button', { name: 'Review a new attempt' })).toBeNull();
  expect(documentService.refresh).not.toHaveBeenCalled();
  expect(JSON.parse(sessionStorage.getItem(recoveryKey('actor-org-epoch', id)))).toEqual(pending);
});

it('keeps a failed ticket blocked until the latest detail and list can both be read', async () => {
  vi.mocked(documentService.refresh).mockRejectedValue(new Error('stale basis'));
  vi.mocked(documentService.request).mockResolvedValue({ status: 'failed' });
  showDetail();
  await user.click(await screen.findByRole('button', { name: 'Refresh stored copy' }));
  vi.mocked(documentService.list).mockRejectedValueOnce(new Error('offline'));
  await user.click(await screen.findByRole('button', { name: 'Look up result' }));
  await waitFor(() => expect(documentService.list).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Review a new attempt' }).hasAttribute('disabled')).toBe(true);
  expect(documentService.refresh).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(recoveryKey('actor-org-epoch', id))).not.toBeNull();
  await user.click(screen.getByRole('button', { name: 'Reload' }));
  await screen.findByLabelText('Stored Markdown text');
  expect(screen.getByRole('button', { name: 'Review a new attempt' }).hasAttribute('disabled')).toBe(false);
  expect(documentService.refresh).toHaveBeenCalledTimes(1);
});
