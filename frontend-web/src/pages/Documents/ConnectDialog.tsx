import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { documentService, DocumentSummary } from '@/api/documentService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export default function ConnectDialog({
  document,
  disabled,
  scope,
}: {
  document?: DocumentSummary;
  disabled: boolean;
  scope: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(document?.sourceUrl ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      generation.current += 1;
      setConsent(false);
      setError(false);
    }
  };
  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !consent || disabled || scope !== personalLibrarySessionScope()) return;
    lock.current = true;
    const attempt = generation.current;
    setBusy(true);
    setError(false);
    try {
      const authorizationUrl = await documentService.start({
        sourceUrl: url.trim(),
        ...(document ? { documentId: document.id } : {}),
      });
      if (attempt === generation.current && scope === personalLibrarySessionScope())
        window.location.assign(authorizationUrl);
    } catch {
      if (attempt === generation.current) setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="h-10">
          {t(document ? 'docConnection.reconnect' : 'docConnection.connect')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogTitle>{t('docConnection.connectTitle')}</DialogTitle>
        <DialogDescription>{t('docConnection.consentDescription')}</DialogDescription>
        <form onSubmit={start} className="flex flex-col gap-4">
          <label htmlFor="google-document-url">{t('docConnection.sourceUrl')}</label>
          <Input
            id="google-document-url"
            className="h-10"
            type="url"
            required
            value={url}
            readOnly={!!document}
            disabled={busy}
            placeholder="https://docs.google.com/document/d/…/edit"
            onChange={event => setUrl(event.target.value)}
          />
          <div className="flex items-start gap-3">
            <Checkbox
              id="google-document-consent"
              disabled={busy}
              checked={consent}
              onCheckedChange={value => setConsent(value === true)}
            />
            <label htmlFor="google-document-consent">{t('docConnection.consent')}</label>
          </div>
          <p className="text-sm text-muted-foreground">{t('docConnection.noAutoImport')}</p>
          {error && <p role="alert">{t('docConnection.connectError')}</p>}
          <div className="flex justify-end gap-2">
            <Button className="h-10" variant="outline" onClick={() => changeOpen(false)}>
              {t('docConnection.cancel')}
            </Button>
            <Button className="h-10" type="submit" disabled={!consent || busy || error}>
              {t(busy ? 'docConnection.working' : 'docConnection.continueGoogle')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
