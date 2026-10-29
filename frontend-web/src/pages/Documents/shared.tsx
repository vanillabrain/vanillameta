import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';

export function useDocumentScope() {
  const [scope, setScope] = useState(personalLibrarySessionScope);
  useEffect(() => {
    const update = () => setScope(personalLibrarySessionScope());
    window.addEventListener('storage', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return scope;
}

export function DocumentFrame({ children, title }: { children: React.ReactNode; title: string }) {
  const { t } = useTranslation();
  const { listHref } = artifactListNavigation(useLocation());
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 p-8" data-route-title={title}>
      <nav aria-label={t('docConnection.breadcrumb')}>
        <Button asChild variant="ghost" className="h-10">
          <Link to={listHref}>
            <ArrowLeft />
            {t('nav.artifacts')}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-10">
          <Link to="/documents">{t('docConnection.title')}</Link>
        </Button>
      </nav>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{t('docConnection.privateHint')}</p>
      {children}
    </main>
  );
}
