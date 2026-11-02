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

export function DocumentFrame({
  children,
  title,
  headingRef,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  headingRef?: React.Ref<HTMLHeadingElement>;
  actions?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { listHref } = artifactListNavigation(useLocation());
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 p-8" data-route-title={title}>
      <nav aria-label={t('docConnection.breadcrumb')} className="-ml-3 flex flex-wrap items-center gap-1">
        <Button asChild variant="ghost" className="h-10">
          <Link to={listHref}>
            <ArrowLeft />
            {t('nav.artifacts')}
          </Link>
        </Button>
        <span aria-hidden="true" className="text-sm text-muted-foreground">
          /
        </span>
        <Button asChild variant="ghost" className="h-10">
          <Link to="/documents">{t('docConnection.title')}</Link>
        </Button>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="w-fit max-w-full rounded-sm text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{t('docConnection.privateHint')}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </main>
  );
}
