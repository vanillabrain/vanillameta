import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FilePreview from './FilePreview';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:artifact');
const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const artifact = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'html' as const,
  title: 'Report',
  headVersion: 1,
  revision: 1,
  size: 10,
  mimeType: 'text/html',
  updatedAt: '2026-10-31',
  shareActive: false,
  safePreview: true,
};

it('renders fetched HTML in a fully sandboxed iframe and provides download', async () => {
  render(
    <FilePreview artifact={artifact} load={async () => new Blob(['<script>alert(1)</script>'], { type: 'text/html' })} />,
  );
  const frame = await screen.findByTitle('fileArtifact.preview');
  expect(frame.getAttribute('src')).toBe('blob:artifact');
  expect(frame.getAttribute('sandbox')).toBe('');
  expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(create).toHaveBeenCalledOnce();
  expect(screen.getByRole('link', { name: 'fileArtifact.download' }).getAttribute('href')).toBe('blob:artifact');
});

it('shows PPTX metadata and download without inventing a renderer', async () => {
  render(
    <FilePreview
      artifact={{
        ...artifact,
        kind: 'pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        safePreview: false,
      }}
      load={async () => new Blob(['zip'])}
    />,
  );
  await waitFor(() => expect(screen.getByRole('link', { name: 'fileArtifact.download' })).toBeTruthy());
  expect(screen.queryByTitle('fileArtifact.preview')).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
});

it('uses a PDF object for the fetched blob', async () => {
  const { container } = render(
    <FilePreview
      artifact={{ ...artifact, kind: 'pdf', mimeType: 'application/pdf' }}
      load={async () => new Blob(['pdf'])}
    />,
  );
  const object = await waitFor(() => {
    const element = container.querySelector('object');
    expect(element).toBeTruthy();
    return element as HTMLObjectElement;
  });
  expect(object.getAttribute('data')).toBe('blob:artifact');
  expect(object.getAttribute('type')).toBe('application/pdf');
});
