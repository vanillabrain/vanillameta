import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import FileUploadDialog from './FileUploadDialog';
import { fileArtifactService } from '@/api/fileArtifactService';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => 'scope' }));
vi.mock('@/api/fileArtifactService', async importOriginal => ({
  ...(await importOriginal<any>()),
  fileArtifactService: { upload: vi.fn(), replace: vi.fn() },
}));
afterEach(cleanup);
const detail = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'html',
  title: 'Report',
  headVersion: 1,
  revision: 1,
  size: 4,
  mimeType: 'text/html',
  updatedAt: '2026-10-31',
  shareActive: false,
  safePreview: true,
  versions: [],
};

it('opens from the keyboard, exposes a named modal, and uploads the selected file', async () => {
  vi.mocked(fileArtifactService.upload).mockResolvedValue(detail as any);
  const saved = vi.fn();
  render(<FileUploadDialog onSaved={saved} />);
  const trigger = screen.getByRole('button', { name: 'fileArtifact.upload' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('dialog', { name: 'fileArtifact.upload' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('fileArtifact.title'), { target: { value: 'Quarterly' } });
  const file = new File(['html'], 'report.html', { type: 'text/html' });
  const input = screen.getByLabelText('fileArtifact.file') as HTMLInputElement;
  await userEvent.upload(input, file);
  const submit = screen.getAllByRole('button', { name: 'fileArtifact.upload' }).at(-1) as HTMLButtonElement;
  expect(submit.disabled).toBe(false);
  fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(fileArtifactService.upload).toHaveBeenCalledWith(file, 'Quarterly'));
  expect(saved).toHaveBeenCalledWith(detail);
});

it('keeps invalid file feedback inside the dialog', async () => {
  render(<FileUploadDialog onSaved={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'fileArtifact.upload' }));
  await userEvent.upload(screen.getByLabelText('fileArtifact.file'), new File(['x'], 'report.docx'));
  fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
  expect(screen.getByRole('alert').textContent).toBe('fileArtifact.invalidFile');
  expect(fileArtifactService.upload).not.toHaveBeenCalled();
});
