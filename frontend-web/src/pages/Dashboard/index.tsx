import React, { useContext, useEffect, useRef, useState } from 'react';
import PageTitleBox from '@/components/PageTitleBox';
import ArtifactLibrary from './ArtifactLibrary';
import FileUploadDialog from '../Artifacts/FileUploadDialog';
import { documentService } from '@/api/documentService';
import { fileArtifactService } from '@/api/fileArtifactService';
import { useProtectedReport } from '../Reports/useProtectedReport';
import { reportSharingApi, ReportLibraryItem } from '../Reports/reportSharingApi';
import { Link, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import { Button } from '@/components/ui/button';
import { MenuButton } from '@/components/button/AddIconButton';
import { Plus, Plug } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import AiDashboardPanel from './Components/AiDashboardPanel';
import GettingStarted from './Components/GettingStarted';
import DashboardDeleteDialog, { DashboardDeleteTarget } from './Components/DashboardDeleteDialog';
import { STORAGE_ACCESS_TOKEN } from '@/helpers/authHelper';
import {
  personalLibrarySessionScope,
  fetchPersonalLibrary,
  savePersonalLibrary,
  personalLibraryError,
  LibraryEntry,
  LibraryView,
} from '@/api/personalLibraryService';

function Dashboard() {
  const { link: artifactLink } = artifactListNavigation(useLocation());
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceParam = searchParams.get('aiSourceId') || '';
  const aiSourceId =
    /^[1-9]\d*$/.test(sourceParam) && Number.isSafeInteger(Number(sourceParam)) ? Number(sourceParam) : undefined;
  const [reportPages, setReportPages] = useState(1);
  const reportLibrary = useProtectedReport(async signal => {
    const items: ReportLibraryItem[] = [];
    let nextCursor: string | null = null;
    for (let page = 0; page < reportPages; page += 1) {
      const result = await reportSharingApi.library(signal, nextCursor ?? undefined);
      items.push(...result.items);
      nextCursor = result.nextCursor;
      if (!nextCursor) break;
    }
    return { items, nextCursor };
  });
  useEffect(() => {
    reportLibrary.reload();
  }, [reportPages]);
  const [aiOpen, setAiOpen] = useState(!!aiSourceId);
  const title = t('nav.artifacts');
  const { dashboardId } = useParams();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  const view: LibraryView = searchParams.get('artifactView') === 'archived' ? 'archived' : 'active';
  const setView = (nextView: LibraryView) => {
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        if (nextView === 'archived') next.set('artifactView', 'archived');
        else next.delete('artifactView');
        return next;
      },
      { replace: true },
    );
  };
  const [, scopeChanged] = useState(0);
  const authScope = personalLibrarySessionScope();
  const currentView = useRef(view);
  currentView.current = view;
  const scope = useRef(authScope);
  scope.current = authScope;
  const generation = useRef(0);
  const mounted = useRef(true);
  const writeLock = useRef(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [needsRead, setNeedsRead] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const queryKey = ['dashboards', 'library', authScope, view];
  useEffect(() => {
    mounted.current = true;
    const changed = (event: StorageEvent) => {
      if (
        (event.key === null || event.key === STORAGE_ACCESS_TOKEN || event.key === 'vm:editor-draft-auth:v1') &&
        scope.current !== personalLibrarySessionScope()
      ) {
        generation.current += 1;
        scopeChanged(value => value + 1);
      }
    };
    window.addEventListener('storage', changed);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.removeEventListener('storage', changed);
    };
  }, []);
  useEffect(() => {
    writeLock.current = false;
    setArchiveBusy(false);
    setNeedsRead(false);
    setArchiveError('');
  }, [authScope]);

  const {
    data: library,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      generation.current += 1;
      const read = generation.current;
      const data = await fetchPersonalLibrary(view, signal);
      if (signal.aborted || authScope !== personalLibrarySessionScope() || read !== generation.current)
        throw new Error('library scope changed');
      return data;
    },
    enabled: authScope !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
  // Failed/refetching lists never leave stale titles or archive versions actionable.
  const loadedDashboardData = !isFetching && !isError && authScope !== null ? library?.entries ?? [] : [];
  const emptyLibrary = library !== undefined && library.entries.length === 0;
  const reloadLibrary = async () => {
    if (writeLock.current || isFetching) return;
    const actor = authScope;
    const request = refetch();
    const read = generation.current;
    const result = await request;
    if (
      !mounted.current ||
      scope.current !== actor ||
      personalLibrarySessionScope() !== actor ||
      currentView.current !== view ||
      generation.current !== read
    )
      return;
    if (!result.isError) {
      setNeedsRead(false);
      setArchiveError('');
    }
  };
  const archive = async (entry: LibraryEntry) => {
    if (
      writeLock.current ||
      needsRead ||
      isFetching ||
      isError ||
      !library?.canArchive ||
      library.organizationId === null ||
      !Number.isSafeInteger(library.actorId) ||
      library.actorId <= 0 ||
      authScope === null ||
      authScope !== personalLibrarySessionScope()
    )
      return;
    writeLock.current = true;
    setArchiveBusy(true);
    setNeedsRead(true);
    setArchiveError('');
    const actor = authScope;
    generation.current += 1;
    const current = generation.current;
    const organizationId = library.organizationId;
    const isCurrent = () =>
      mounted.current &&
      current === generation.current &&
      scope.current === actor &&
      personalLibrarySessionScope() === actor;
    try {
      await savePersonalLibrary(entry, organizationId, library.actorId);
      if (!isCurrent()) return;
      queryClient.setQueryData(queryKey, { ...library, entries: library.entries.filter(item => item.id !== entry.id) });
      void queryClient.invalidateQueries({ queryKey: ['dashboards', 'library'], refetchType: 'none' });
      setNeedsRead(false);
    } catch (error) {
      if (isCurrent()) setArchiveError(personalLibraryError(error));
    } finally {
      // A newer list read supersedes the response, but it still releases this scope's pending UI.
      if (mounted.current && scope.current === actor && personalLibrarySessionScope() === actor) {
        writeLock.current = false;
        setArchiveBusy(false);
      }
    }
  };

  useEffect(() => {
    if (isFetching) {
      showLoading();
      // A save can navigate away while list invalidation is still fetching.
      return hideLoading;
    }
    hideLoading();
  }, [isFetching]);

  useEffect(() => {
    if (isError) alert.error(t('dashboard.loadFailed'));
  }, [isError]);

  const documentsQuery = useQuery({
    queryKey: ['artifact-hub', 'documents', authScope],
    queryFn: ({ signal }) => documentService.list(signal),
    enabled: authScope !== null && view === 'active',
    retry: false,
    refetchOnWindowFocus: false,
  });
  const filesQuery = useQuery({
    queryKey: ['artifact-hub', 'files', authScope],
    queryFn: ({ signal }) => fileArtifactService.list(signal),
    enabled: authScope !== null && view === 'active',
    retry: false,
    refetchOnWindowFocus: false,
  });
  const supplementaryLoading = view === 'active' && (documentsQuery.isFetching || filesQuery.isFetching);
  const supplementaryError =
    view === 'active' && (documentsQuery.isError || filesQuery.isError) ? t('artifact.supplementaryError') : '';
  const reloadArtifacts = () => {
    void reloadLibrary();
    reportLibrary.reload();
    if (view === 'active') {
      void documentsQuery.refetch();
      void filesQuery.refetch();
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<DashboardDeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuList = [
    { name: 'AI 대시보드 만들기', link: '/studio/new', id: 'ai' },
    { name: t('nav.dashboard'), link: '/dashboard/create', id: 'dashboard' },
    { name: t('list.recommend'), link: '', id: 'recommend' },
  ];

  const handleDeleteSelect = (id, title) => {
    setDeleteTarget({ id: Number(id), title });
    setDeleteOpen(true);
  };

  const handleMenuSelect = item => {
    if (item.id !== undefined) {
      if (item.id === 'ai') {
        navigate(artifactLink('/studio/new'));
      } else if (item.id == 'dashboard') {
        navigate('/dashboard/create?createType=dashboard');
      } else {
        navigate('/dashboard/create?createType=recommend');
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-auto flex-col">
      <Seo title={title} />
      <DashboardDeleteDialog
        target={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          void queryClient.invalidateQueries({ queryKey: ['dashboards'] });
          snackbar.success(t('dashboard.deleted'));
        }}
      />
      <AiDashboardPanel
        open={aiOpen}
        initialDatabaseId={aiSourceId}
        onClose={() => {
          setAiOpen(false);
          if (searchParams.has('aiSourceId')) {
            const next = new URLSearchParams(searchParams);
            next.delete('aiSourceId');
            setSearchParams(next, { replace: true });
          }
        }}
        onSaved={(id, intent) => {
          setAiOpen(false);
          queryClient.invalidateQueries({ queryKey: ['dashboards'] });
          navigate(
            intent?.publication
              ? `/dashboard/${id}/publication${intent.revision ? `?savedRevision=${intent.revision}` : ''}`
              : `/dashboard/${id}`,
          );
        }}
      />

      {!dashboardId ? (
        <>
          <PageTitleBox
            title={title}
            className="mx-auto max-w-[1280px] gap-6 lg:px-12 lg:py-8"
            button={
              <MenuButton
                menuList={menuList}
                handleSelect={handleMenuSelect}
                icon={<Plus />}
                title={t('list.addDashboard')}
                className="h-10 min-w-[160px] w-auto px-4"
              />
            }
          >
            <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="h-10">
                <Link to={artifactLink('/documents')}>{t('docConnection.title')}</Link>
              </Button>
              <Button asChild variant="outline" className="h-10">
                <Link to="/ai-connections">
                  <Plug />
                  {t('aiConnections.title')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/organizations">{t('artifact.organization')}</Link>
              </Button>
              <span className="text-xs text-muted-foreground">{t('artifact.organizationHint')}</span>
            </div>
            {view === 'active' && (
              <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3">
                <FileUploadDialog
                  onSaved={() => {
                    void queryClient.invalidateQueries({ queryKey: ['artifact-hub', 'files', authScope] });
                  }}
                />
                <span className="text-xs text-muted-foreground">{t('fileArtifact.hubHint')}</span>
              </div>
            )}
            <div>
              <ArtifactLibrary
                key={authScope ?? 'unavailable-session'}
                items={loadedDashboardData}
                reports={view === 'active' ? reportLibrary.retained?.data.items ?? [] : []}
                reportBoundary={
                  view === 'active' && reportLibrary.retained?.data.items.length ? reportLibrary.boundary : undefined
                }
                reportsReady={
                  view !== 'active' || !reportLibrary.retained?.data.items.length || reportLibrary.state.kind === 'ready'
                }
                documents={view === 'active' && !documentsQuery.isError ? documentsQuery.data?.documents ?? [] : []}
                files={view === 'active' && !filesQuery.isError ? filesQuery.data ?? [] : []}
                supplementaryLoading={supplementaryLoading}
                supplementaryError={supplementaryError}
                onDelete={handleDeleteSelect}
                view={view}
                onViewChange={setView}
                onReload={reloadArtifacts}
                loading={isFetching}
                listError={isError || authScope === null}
                canArchive={library?.canArchive === true && !isFetching && !isError}
                onArchive={archive}
                archiveDisabled={archiveBusy || needsRead}
                archiveError={archiveError || (needsRead && !archiveBusy ? t('artifact.needsRead') : '')}
                busy={archiveBusy}
              />
            </div>
            {view === 'active' && reportLibrary.state.kind === 'error' && (
              <p role="alert" className="mb-4">
                보고서 목록을 불러오지 못했습니다. 다른 산출물은 표시합니다. {reportLibrary.state.message}
              </p>
            )}
            {view === 'active' && reportLibrary.state.kind === 'loading' && (
              <p role="status" className="mb-4">
                보고서 접근권을 확인하고 있습니다.
              </p>
            )}
            {view === 'active' && reportLibrary.state.kind === 'ready' && reportLibrary.state.data.nextCursor && (
              <Button className="my-4 h-10" variant="outline" onClick={() => setReportPages(value => value + 1)}>
                보고서 더 불러오기 · 현재 불러온 항목에서 검색
              </Button>
            )}
            <details
              key={authScope ?? 'unavailable-session'}
              open={emptyLibrary}
              className="rounded-xl border border-border bg-muted/30 p-5"
            >
              <summary className="cursor-pointer text-sm font-medium">{t('artifact.startAnalysis')}</summary>
              <div className="mt-5">
                <GettingStarted returning={!emptyLibrary} />
              </div>
            </details>
          </PageTitleBox>
        </>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

export default Dashboard;
