import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileArtifactDetail, fileArtifactService, fileUploadError } from '@/api/fileArtifactService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { FieldGroup } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function FileUploadDialog({
  artifact,
  onSaved,
}: {
  artifact?: FileArtifactDetail;
  onSaved: (detail: FileArtifactDetail) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const scope = personalLibrarySessionScope();
  const label = t(artifact ? 'fileArtifact.replace' : 'fileArtifact.upload');
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || lock.current || !scope || scope !== personalLibrarySessionScope()) return;
    const invalid = fileUploadError(file, artifact?.kind);
    if (invalid) {
      setError(t(`fileArtifact.${invalid}`));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const detail = artifact
        ? await fileArtifactService.replace(artifact.id, file, artifact.headVersion)
        : await fileArtifactService.upload(file, title);
      if (scope !== personalLibrarySessionScope()) return;
      onSaved(detail);
      setFile(null);
      setTitle('');
      setOpen(false);
    } catch (cause) {
      if (scope === personalLibrarySessionScope())
        setError(
          t(
            (cause as { response?: { status?: number } })?.response?.status === 409
              ? 'fileArtifact.conflict'
              : 'fileArtifact.writeError',
          ),
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!busy) {
          setOpen(value);
          setFile(null);
          setTitle('');
          setError('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={artifact ? 'outline' : 'default'} className="h-10">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] min-w-0 overflow-y-auto sm:max-w-lg"
        onEscapeKeyDown={event => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogTitle className="pr-8">{label}</DialogTitle>
        <DialogDescription>{t('fileArtifact.uploadHint')}</DialogDescription>
        <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
          <FieldGroup>
            {!artifact && (
              <TextField
                label={t('fileArtifact.title')}
                value={title}
                maxLength={200}
                disabled={busy}
                onChange={event => setTitle(event.target.value)}
              />
            )}
            <TextField
              label={t('fileArtifact.file')}
              aria-label={t('fileArtifact.file')}
              type="file"
              required
              accept={artifact ? (artifact.kind === 'html' ? '.html,.htm' : `.${artifact.kind}`) : '.html,.htm,.pdf,.pptx'}
              disabled={busy}
              onChange={event => {
                setFile(event.target.files?.[0] ?? null);
                setError('');
              }}
              className="[&_input]:h-10 [&_input]:max-w-full [&_input]:text-base"
            />
          </FieldGroup>
          {artifact && (
            <p className="break-words text-sm">
              {artifact.title} · {t('fileArtifact.version', { version: artifact.headVersion })}
            </p>
          )}
          {error && (
            <p role="alert" className="break-words">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-10" disabled={busy || !file}>
              {busy ? t('fileArtifact.working') : label}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setFile(null);
                setTitle('');
                setError('');
              }}
            >
              {t('fileArtifact.cancel')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
