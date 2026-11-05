import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import type { AiScope, ConsentRequest } from '@/api/aiConnectionsService';

/** Anything the server does not call a read is grouped with the writes and starts unchecked. */
export const isWriteScope = (request: Pick<ConsentRequest, 'scopeKinds'>, scope: AiScope) =>
  request.scopeKinds[scope] !== 'read';
export const SCOPE_LABELS: Record<AiScope, string> = {
  'sources:read': 'aiConnections.sourcesRead',
  'documents:read': 'aiConnections.documentsRead',
  'reports:read': 'aiConnections.reportsRead',
  'comments:read': 'aiConnections.commentsRead',
  'comments:write': 'aiConnections.commentsWrite',
  'suggestions:write': 'aiConnections.suggestionsWrite',
  'shares:write': 'aiConnections.sharesWrite',
};
export const SCOPE_WARNINGS: Partial<Record<AiScope, string>> = {
  'shares:write': 'aiConnections.sharesWriteWarning',
};

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
