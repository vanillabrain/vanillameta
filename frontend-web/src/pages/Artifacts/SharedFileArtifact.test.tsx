import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import SharedFileArtifact from './SharedFileArtifact';
import { fileArtifactService } from '@/api/fileArtifactService';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/api/fileArtifactService', async importOriginal => ({
  ...(await importOriginal<any>()),
  fileArtifactService: { shared: vi.fn(), sharedContent: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('shows only the shared metadata, safe preview and reload without owner controls', async () => {
  vi.mocked(fileArtifactService.shared).mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'html',
    title: 'Shared report',
    headVersion: 2,
    revision: 3,
    size: 64,
    mimeType: 'text/html',
    updatedAt: '2026-10-31T00:00:00.000Z',
    shareActive: true,
    safePreview: true,
  });
  vi.mocked(fileArtifactService.sharedContent).mockResolvedValue(new Blob(['<p>public copy</p>']));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:shared');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/artifacts/shared/token']}>
        <Routes>
          <Route path="/artifacts/shared/:token" element={<SharedFileArtifact />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('heading', { name: 'Shared report' })).toBeTruthy();
  expect(await screen.findByTitle('fileArtifact.preview')).toBeTruthy();
  expect(fileArtifactService.sharedContent).toHaveBeenCalledWith('token', expect.any(AbortSignal));
  expect(screen.queryByRole('button', { name: 'fileArtifact.share' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'fileArtifact.delete' })).toBeNull();
});
