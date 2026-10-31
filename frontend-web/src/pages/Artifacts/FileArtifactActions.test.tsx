import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import FileArtifactActions from './FileArtifactActions';
import { fileArtifactService } from '@/api/fileArtifactService';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => 'scope' }));
vi.mock('@/api/fileArtifactService', async importOriginal => ({
  ...(await importOriginal<any>()),
  fileArtifactService: { share: vi.fn(), revoke: vi.fn(), remove: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const artifact = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'html' as const,
  title: 'Report',
  headVersion: 2,
  revision: 4,
  size: 128,
  mimeType: 'text/html',
  updatedAt: '2026-10-31',
  shareActive: true,
  safePreview: true,
  versions: [],
};

it('creates a token link in a keyboard reachable modal and exposes it once', async () => {
  vi.mocked(fileArtifactService.share).mockResolvedValue({ token: 'one-time-token', expiresAt: null });
  render(<FileArtifactActions artifact={artifact} onChanged={vi.fn()} onDeleted={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'fileArtifact.share' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('dialog', { name: 'fileArtifact.share' })).toBeTruthy();
  fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
  expect(await screen.findByDisplayValue(`${window.location.origin}/artifacts/shared/one-time-token`)).toBeTruthy();
  expect(screen.getByText('fileArtifact.tokenOnce')).toBeTruthy();
  expect(fileArtifactService.share).toHaveBeenCalledWith(artifact.id, undefined);
});

it('revokes an active share link through an explicit dialog', async () => {
  const changed = vi.fn();
  vi.mocked(fileArtifactService.revoke).mockResolvedValue();
  render(<FileArtifactActions artifact={artifact} onChanged={changed} onDeleted={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'fileArtifact.revoke' }));
  expect(await screen.findByRole('dialog', { name: 'fileArtifact.revoke' })).toBeTruthy();
  fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(fileArtifactService.revoke).toHaveBeenCalledWith(artifact.id));
  expect(changed).toHaveBeenCalledOnce();
});

it('submits the current revision for delete and reports the completed removal', async () => {
  const deleted = vi.fn();
  vi.mocked(fileArtifactService.remove).mockResolvedValue();
  render(<FileArtifactActions artifact={artifact} onChanged={vi.fn()} onDeleted={deleted} />);
  fireEvent.click(screen.getByRole('button', { name: 'fileArtifact.delete' }));
  expect(await screen.findByRole('dialog', { name: 'fileArtifact.delete' })).toBeTruthy();
  fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(fileArtifactService.remove).toHaveBeenCalledWith(artifact.id, 4));
  expect(deleted).toHaveBeenCalledOnce();
});
