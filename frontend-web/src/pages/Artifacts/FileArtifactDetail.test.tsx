import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import FileArtifactDetail from './FileArtifactDetail';
import { fileArtifactService } from '@/api/fileArtifactService';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => 'scope' }));
vi.mock('@/api/fileArtifactService', async importOriginal => ({
  ...(await importOriginal<any>()),
  fileArtifactService: { detail: vi.fn(), content: vi.fn() },
}));
vi.mock('./FileUploadDialog', () => ({ default: () => <button>fileArtifact.replace</button> }));
vi.mock('./FileArtifactActions', () => ({ default: () => <button>fileArtifact.share</button> }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const id = '11111111-1111-4111-8111-111111111111';
const detail = {
  id,
  kind: 'html' as const,
  title: 'Quarterly report',
  headVersion: 2,
  revision: 3,
  size: 128,
  mimeType: 'text/html',
  updatedAt: '2026-10-31T00:00:00.000Z',
  shareActive: false,
  safePreview: true,
  versions: [
    {
      version: 2,
      originalName: 'report-v2.html',
      mimeType: 'text/html',
      byteSize: 128,
      sha256: 'b'.repeat(64),
      createdAt: '2026-10-31T00:00:00.000Z',
    },
    {
      version: 1,
      originalName: 'report-v1.html',
      mimeType: 'text/html',
      byteSize: 64,
      sha256: 'a'.repeat(64),
      createdAt: '2026-10-30T00:00:00.000Z',
    },
  ],
};

it('loads owner metadata and fetches exactly the selected version into the sandbox preview', async () => {
  vi.mocked(fileArtifactService.detail).mockResolvedValue(detail);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:selected');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.mocked(fileArtifactService.content).mockResolvedValue(new Blob(['<p>selected</p>']));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/artifacts/files/${id}`]}>
        <Routes>
          <Route path="/artifacts/files/:id" element={<FileArtifactDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('heading', { name: 'Quarterly report' })).toBeTruthy();
  expect((await screen.findAllByText(/report-v2.html/)).length).toBeGreaterThan(0);
  expect(await screen.findByTitle('fileArtifact.preview')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('fileArtifact.versions'), { target: { value: '1' } });
  await waitFor(() => expect(fileArtifactService.content).toHaveBeenLastCalledWith(id, 1, expect.any(AbortSignal)));
  expect((await screen.findAllByText(/report-v1.html/)).length).toBeGreaterThan(0);
});
