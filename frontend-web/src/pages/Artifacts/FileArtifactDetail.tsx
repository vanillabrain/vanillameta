import React, { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fileArtifactService } from '@/api/fileArtifactService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useDocumentScope } from '../Documents/shared';
import FileUploadDialog from './FileUploadDialog';
import FileArtifactActions from './FileArtifactActions';
import FilePreview from './FilePreview';

function OwnerFile({ id, scope }: { id: string; scope: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = artifactListNavigation(useLocation());
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ['file-artifact', scope, id],
    queryFn: async ({ signal }) => {
      const result = await fileArtifactService.detail(id, signal);
      if (scope !== personalLibrarySessionScope()) throw new Error('Session changed');
      return result;
    },
    enabled: !!scope && !!id,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const artifact = !query.isFetching && !query.isError && scope ? query.data : undefined;
  const version = selectedVersion ?? artifact?.headVersion;
  const load = useCallback((signal: AbortSignal) => fileArtifactService.content(id, version, signal), [id, version]);
  const reload = () => {
    setSelectedVersion(null);
    void query.refetch();
  };
  const selected = artifact?.versions.find(item => item.version === version);
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 p-4 sm:p-8 lg:p-12">
      <Button asChild variant="ghost" className="h-10 self-start">
        <Link to={navigation.listHref}>{t('nav.artifacts')}</Link>
      </Button>
      <h1 className="break-words text-2xl font-semibold">{artifact?.title ?? t('fileArtifact.detail')}</h1>
      {query.isFetching && <p role="status">{t('fileArtifact.loading')}</p>}
      {(query.isError || !scope) && <p role="alert">{t('fileArtifact.loadError')}</p>}
      <div>
        <Button variant="outline" className="h-10" disabled={query.isFetching || !scope} onClick={reload}>
          {t('fileArtifact.reload')}
        </Button>
      </div>
      {artifact && (
        <>
          <p className="break-words text-sm text-muted-foreground">
            {artifact.kind.toUpperCase()} · {artifact.size.toLocaleString()} {t('fileArtifact.bytes')} ·{' '}
            {t('fileArtifact.version', { version: artifact.headVersion })} · {new Date(artifact.updatedAt).toLocaleString()}
          </p>
          <p className="text-sm">{t(artifact.shareActive ? 'fileArtifact.shared' : 'fileArtifact.private')}</p>
          <div className="flex min-w-0 flex-wrap gap-2">
            <FileUploadDialog artifact={artifact} onSaved={reload} />
            <FileArtifactActions artifact={artifact} onChanged={reload} onDeleted={() => navigate(navigation.listHref)} />
          </div>
          <TextField
            select
            label={t('fileArtifact.versions')}
            value={version}
            onChange={event => setSelectedVersion(Number(event.target.value))}
            className="max-w-full sm:max-w-md [&_select]:h-10 [&_select]:text-base"
          >
            {artifact.versions.map(item => (
              <option key={item.version} value={item.version}>
                {t('fileArtifact.version', { version: item.version })} · {item.originalName}
              </option>
            ))}
          </TextField>
          {selected && (
            <dl className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt>{t('fileArtifact.file')}</dt>
              <dd className="break-all">{selected.originalName}</dd>
              <dt>{t('fileArtifact.mime')}</dt>
              <dd className="break-all">{selected.mimeType}</dd>
              <dt>{t('fileArtifact.size')}</dt>
              <dd>
                {selected.byteSize.toLocaleString()} {t('fileArtifact.bytes')}
              </dd>
              <dt>{t('fileArtifact.created')}</dt>
              <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
              <dt>SHA-256</dt>
              <dd className="break-all font-mono text-xs">{selected.sha256}</dd>
            </dl>
          )}
          {selected && (
            <FilePreview key={`${id}-${version}`} artifact={artifact} load={load} originalName={selected.originalName} />
          )}
        </>
      )}
    </main>
  );
}
export default function FileArtifactDetail() {
  const { id = '' } = useParams();
  const scope = useDocumentScope();
  return <OwnerFile key={`${scope}-${id}`} id={id} scope={scope} />;
}
