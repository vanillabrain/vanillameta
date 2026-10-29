import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { documentService } from '@/api/documentService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { DocumentFrame } from './shared';

function captureCallback() {
  const params = new URLSearchParams(window.location.search);
  const single = (key: string) => (params.getAll(key).length === 1 ? params.get(key) : null);
  const state = single('state');
  const code = single('code');
  const pickedFileIds = single('picked_file_ids');
  return !params.has('error') && state && code && pickedFileIds ? { state, code, pickedFileIds } : null;
}

export default function GoogleCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const input = useRef(captureCallback());
  const started = useRef(false);
  const alive = useRef(true);
  useLayoutEffect(() => {
    window.history.replaceState(window.history.state, '', '/documents/google/callback');
  }, []);
  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      const captured = input.current;
      input.current = null;
      const scope = personalLibrarySessionScope();
      if (!captured || !scope) setFailed(true);
      else
        void documentService
          .complete(captured)
          .then(documentId => {
            if (alive.current && scope === personalLibrarySessionScope())
              navigate(`/documents/${documentId}`, { replace: true });
            else if (alive.current) setFailed(true);
          })
          .catch(() => {
            if (alive.current) setFailed(true);
          });
    }
    return () => {
      alive.current = false;
      input.current = null;
    };
  }, [navigate]);
  return (
    <DocumentFrame title={t('docConnection.callbackTitle')}>
      <p role={failed ? 'alert' : 'status'}>{t(failed ? 'docConnection.callbackError' : 'docConnection.working')}</p>
      <Button asChild variant="outline" className="h-10 self-start">
        <Link to="/documents">{t('docConnection.return')}</Link>
      </Button>
    </DocumentFrame>
  );
}
