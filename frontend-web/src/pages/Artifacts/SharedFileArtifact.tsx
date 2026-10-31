import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fileArtifactService } from '@/api/fileArtifactService';
import { Button } from '@/components/ui/button';
import FilePreview from './FilePreview';

export default function SharedFileArtifact() {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['shared-file-artifact', token],
    queryFn: ({ signal }) => fileArtifactService.shared(token, signal),
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  const load = useCallback((signal: AbortSignal) => fileArtifactService.sharedContent(token, signal), [token]);
  const artifact = !query.isFetching && !query.isError ? query.data : undefined;
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 p-4 sm:p-8 lg:p-12">
      <h1 className="break-words text-2xl font-semibold">{artifact?.title ?? t('fileArtifact.sharedFile')}</h1>
      {query.isFetching && <p role="status">{t('fileArtifact.loading')}</p>}
      {(query.isError || !token) && <p role="alert">{t('fileArtifact.sharedError')}</p>}
      <Button variant="outline" className="h-10 self-start" disabled={query.isFetching} onClick={() => void query.refetch()}>
        {t('fileArtifact.reload')}
      </Button>
      {artifact && (
        <>
          <p className="break-words text-sm text-muted-foreground">
            {artifact.kind.toUpperCase()} · {artifact.size.toLocaleString()} {t('fileArtifact.bytes')} ·{' '}
            {t('fileArtifact.version', { version: artifact.headVersion })}
          </p>
          <FilePreview key={`${token}-${artifact.headVersion}-${artifact.revision}`} artifact={artifact} load={load} />
        </>
      )}
    </main>
  );
}
