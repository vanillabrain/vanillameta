import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AiArtifactDetail, aiArtifactService } from '@/api/aiArtifactService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';

type Props = {
  id: string;
  scope: string;
  revision: number;
  expectedRevision: number;
  onRestored: () => void;
};

export function RestoreRevision({ id, scope, revision, expectedRevision, onRestored }: Props) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [stage, setStage] = React.useState<'idle' | 'review' | 'saving' | 'error'>('idle');
  const lock = React.useRef(false);
  const mounted = React.useRef(false);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const cancel = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  React.useEffect(() => {
    if (stage === 'review') cancel.current?.focus();
  }, [stage]);
  async function apply() {
    if (lock.current || stage !== 'review' || scope !== personalLibrarySessionScope()) return;
    lock.current = true;
    setStage('saving');
    try {
      const restored = await aiArtifactService.restore(id, revision, expectedRevision);
      if (scope !== personalLibrarySessionScope()) return;
      const key = ['ai-artifact', scope, id];
      await client.cancelQueries({ queryKey: key, exact: true });
      client.setQueryData<AiArtifactDetail>(key, prior => (prior && prior.revision > restored.revision ? prior : restored));
      void client.invalidateQueries({ queryKey: ['artifact-hub', 'ai-artifacts', scope] });
      if (mounted.current) onRestored();
    } catch {
      if (mounted.current) setStage('error');
    } finally {
      lock.current = false;
    }
  }
  if (stage === 'error')
    return (
      <p role="alert" className="rounded-lg border border-border p-4 text-sm">
        {t('aiArtifact.restoreError')}{' '}
        <Button
          variant="outline"
          onClick={() => client.invalidateQueries({ queryKey: ['ai-artifact', scope, id], exact: true })}
        >
          {t('aiArtifact.checkLatest')}
        </Button>
      </p>
    );
  return (
    <div className="space-y-3">
      <Button ref={trigger} variant="outline" disabled={stage !== 'idle'} onClick={() => setStage('review')}>
        {t('aiArtifact.restore')}
      </Button>
      {stage !== 'idle' && (
        <section aria-label={t('aiArtifact.restore')} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm">{t('aiArtifact.restoreReview', { revision, next: expectedRevision + 1 })}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={cancel}
              variant="outline"
              disabled={stage === 'saving'}
              onClick={() => {
                setStage('idle');
                requestAnimationFrame(() => trigger.current?.focus());
              }}
            >
              {t('aiArtifact.cancelRestore')}
            </Button>
            <Button disabled={stage === 'saving'} onClick={apply}>
              {t('aiArtifact.confirmRestore')}
            </Button>
          </div>
          {stage === 'saving' && <p role="status">{t('aiArtifact.restoring')}</p>}
        </section>
      )}
    </div>
  );
}
