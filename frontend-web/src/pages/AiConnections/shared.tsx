import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Copy, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';

export const SCOPE_LABEL_KEYS: Record<string, string> = {
  'sources:read': 'sourcesRead',
  'documents:read': 'documentsRead',
  'artifacts:read': 'artifactsRead',
  'artifacts:write': 'artifactsWrite',
};

export function CopyableCommand({
  command,
  commandLabel,
  copyLabel,
}: {
  command: string;
  commandLabel: string;
  copyLabel: string;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const copy = async () => {
    setState('idle');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(command);
      setState('copied');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
        <pre
          tabIndex={0}
          aria-label={commandLabel}
          className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs leading-5 whitespace-pre"
        >
          <code>{command}</code>
        </pre>
        <Button
          type="button"
          variant="outline"
          className="h-10 self-start"
          aria-label={copyLabel}
          onClick={() => void copy()}
        >
          {state === 'copied' ? <Check /> : <Copy />}
          {t('aiConnections.copy')}
        </Button>
      </div>
      {state !== 'idle' && (
        <p role="status" className="text-xs text-muted-foreground">
          {t(state === 'copied' ? 'aiConnections.copied' : 'aiConnections.copyError')}
        </p>
      )}
    </div>
  );
}

export function useConnectionScope() {
  const [scope, setScope] = useState(personalLibrarySessionScope);
  useEffect(() => {
    const update = () => setScope(personalLibrarySessionScope());
    window.addEventListener('storage', update);
    window.addEventListener('focus', update);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('focus', update);
      clearInterval(timer);
    };
  }, []);
  return scope;
}
export function ConnectionFrame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 p-8">
      <nav>
        <Button asChild variant="ghost" className="h-10">
          <Link to="/dashboard">
            <ArrowLeft />
            {t('nav.artifacts')}
          </Link>
        </Button>
      </nav>
      <h1 className="flex items-center gap-3 text-2xl font-semibold">
        <Plug />
        {t('aiConnections.title')}
      </h1>
      <p className="break-keep text-sm text-muted-foreground">{t('aiConnections.privacy')}</p>
      {children}
    </main>
  );
}
