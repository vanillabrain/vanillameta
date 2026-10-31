import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileArtifactDetail, fileArtifactService } from '@/api/fileArtifactService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Action = 'share' | 'revoke' | 'delete';
export default function FileArtifactActions({
  artifact,
  onChanged,
  onDeleted,
}: {
  artifact: FileArtifactDetail;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const [action, setAction] = useState<Action | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [shared, setShared] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const scope = personalLibrarySessionScope();
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action || lock.current || !scope || scope !== personalLibrarySessionScope()) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (action === 'share') {
        const result = await fileArtifactService.share(
          artifact.id,
          expiresAt ? new Date(expiresAt).toISOString() : undefined,
        );
        if (scope !== personalLibrarySessionScope()) return;
        setShared({
          url: `${window.location.origin}/artifacts/shared/${encodeURIComponent(result.token)}`,
          expiresAt: result.expiresAt,
        });
      } else {
        if (action === 'revoke') await fileArtifactService.revoke(artifact.id);
        else await fileArtifactService.remove(artifact.id, artifact.revision);
        if (scope !== personalLibrarySessionScope()) return;
        setAction(null);
        if (action === 'delete') onDeleted();
        else onChanged();
      }
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
      open={action !== null}
      onOpenChange={open => {
        if (!open && !busy) {
          const created = !!shared;
          setAction(null);
          setShared(null);
          if (created) onChanged();
        }
      }}
    >
      <div className="flex min-w-0 flex-wrap gap-2">
        {(['share', ...(artifact.shareActive ? ['revoke'] : []), 'delete'] as Action[]).map(value => (
          <DialogTrigger asChild key={value}>
            <Button
              className="h-10"
              variant={value === 'delete' ? 'destructive' : 'outline'}
              onClick={() => {
                setAction(value);
                setShared(null);
                setExpiresAt('');
                setError('');
                setCopied(false);
              }}
            >
              {t(`fileArtifact.${value}`)}
            </Button>
          </DialogTrigger>
        ))}
      </div>
      <DialogContent className="max-h-[90vh] min-w-0 overflow-y-auto sm:max-w-lg">
        <DialogTitle className="break-words pr-8">{t(`fileArtifact.${action ?? 'share'}`)}</DialogTitle>
        <DialogDescription>{t(`fileArtifact.${action ?? 'share'}Hint`)}</DialogDescription>
        <p className="break-words">{artifact.title}</p>
        {shared ? (
          <div className="flex min-w-0 flex-col gap-4">
            <TextField
              label={t('fileArtifact.shareLink')}
              value={shared.url}
              readOnly
              onFocus={event => event.target.select()}
              className="[&_input]:text-base"
            />
            <p className="text-sm">
              {t('fileArtifact.expires')} ·{' '}
              {shared.expiresAt ? new Date(shared.expiresAt).toLocaleString() : t('fileArtifact.noExpiry')}
            </p>
            <p className="text-sm text-muted-foreground">{t('fileArtifact.tokenOnce')}</p>
            <Button
              className="h-10 self-start"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shared.url);
                  setCopied(true);
                } catch {
                  setError(t('fileArtifact.copyError'));
                }
              }}
            >
              {t('fileArtifact.copy')}
            </Button>
            {copied && <p role="status">{t('fileArtifact.copied')}</p>}
          </div>
        ) : (
          <form onSubmit={confirm} className="flex min-w-0 flex-col gap-4">
            {action === 'share' && (
              <TextField
                label={t('fileArtifact.expires')}
                type="datetime-local"
                value={expiresAt}
                disabled={busy}
                onChange={event => setExpiresAt(event.target.value)}
                className="[&_input]:h-10 [&_input]:text-base"
              />
            )}
            <Button
              type="submit"
              className="h-10 self-start"
              variant={action === 'delete' ? 'destructive' : 'default'}
              disabled={busy}
            >
              {busy ? t('fileArtifact.working') : t('fileArtifact.confirm')}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="break-words">
            {error}
          </p>
        )}
        <Button
          variant="outline"
          className="h-10 self-start"
          disabled={busy}
          onClick={() => {
            const created = !!shared;
            setAction(null);
            setShared(null);
            if (created) onChanged();
          }}
        >
          {t('fileArtifact.close')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
