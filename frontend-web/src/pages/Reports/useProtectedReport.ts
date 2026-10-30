import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { isReportAccessError, reportError } from './reportApi';

type ProtectedState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: T; generation: number; scope: string };
export function useProtectedReport<T>(load: (signal: AbortSignal) => Promise<T>, onAccessFailure?: () => void) {
  const boundary = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const focused = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const loader = useRef(load);
  loader.current = load;
  const accessFailure = useRef(onAccessFailure);
  accessFailure.current = onAccessFailure;
  const retained = useRef<{ data: T; scope: string } | null>(null);
  const [state, setState] = useState<ProtectedState<T>>({ kind: 'loading' });
  const current = useCallback(
    (stamp: number, scope: string) =>
      generation.current === stamp &&
      personalLibrarySessionScope() === scope &&
      document.visibilityState !== 'hidden' &&
      focused.current,
    [],
  );
  const conceal = useCallback(() => {
    if (boundary.current) boundary.current.hidden = true;
    generation.current += 1;
    controller.current?.abort();
    setState({ kind: 'loading' });
  }, []);
  const reload = useCallback(() => {
    conceal();
    if (document.visibilityState === 'hidden' || !focused.current) return;
    const scope = personalLibrarySessionScope();
    if (retained.current?.scope !== scope) retained.current = null;
    if (!scope) {
      setState({ kind: 'error', message: '로그인한 뒤 보고서를 열어 주세요.' });
      return;
    }
    const stamp = generation.current;
    const request = new AbortController();
    controller.current = request;
    void loader
      .current(request.signal)
      .then(data => {
        if (!request.signal.aborted && current(stamp, scope)) {
          retained.current = { data, scope };
          setState({ kind: 'ready', data, generation: stamp, scope });
        }
      })
      .catch(error => {
        if (!request.signal.aborted && current(stamp, scope)) {
          retained.current = null;
          setState({ kind: 'error', message: reportError(error, 'load') });
          if (isReportAccessError(error)) accessFailure.current?.();
        }
      });
  }, [conceal, current]);
  useEffect(() => {
    const visibility = () => (document.visibilityState === 'hidden' ? conceal() : reload());
    const storage = () => reload();
    const blur = () => {
      focused.current = false;
      conceal();
    };
    const focus = () => {
      focused.current = true;
      reload();
    };
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', conceal);
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', reload);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    reload();
    return () => {
      generation.current += 1;
      controller.current?.abort();
      window.removeEventListener('blur', blur);
      window.removeEventListener('pagehide', conceal);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pageshow', reload);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [conceal, reload]);
  useLayoutEffect(() => {
    if (boundary.current) boundary.current.hidden = state.kind !== 'ready' || !current(state.generation, state.scope);
  });
  const visibleState =
    state.kind === 'ready' && !current(state.generation, state.scope) ? { kind: 'loading' as const } : state;
  return {
    state: visibleState,
    retained: retained.current?.scope === personalLibrarySessionScope() ? retained.current : null,
    boundary,
    reload,
    current,
  };
}
