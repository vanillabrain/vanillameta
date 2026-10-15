import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/spinner';
import { connectSocket } from '@/helpers/socket';
import { cn } from '@/lib/utils';

interface LoadingProps {
  in: boolean;
  style?: React.CSSProperties;
  className?: string;
  label?: string;
  rest?: any;
}

const duration = 100;

type LoadingPhase = 'entering' | 'entered' | 'exiting' | 'exited';

const stateClassNames: Record<LoadingPhase, string> = {
  entering: 'opacity-40',
  entered: 'opacity-40',
  exiting: 'opacity-0',
  exited: 'hidden',
};

export const Loading = ({ in: inProp, style, className, label, ...rest }: LoadingProps) => {
  const { t } = useTranslation();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [phase, setPhase] = useState<LoadingPhase>(inProp ? 'entered' : 'exited');

  useEffect(() => {
    if (inProp) {
      setPhase('entering');
    } else {
      setPhase(current => (current === 'exited' ? current : 'exiting'));
    }
    const timer = setTimeout(() => setPhase(inProp ? 'entered' : 'exited'), duration);
    return () => clearTimeout(timer);
  }, [inProp]);

  useEffect(() => {
    const s = connectSocket();
    const onProgress = (payload: { phase: string; elapsedMs: number }) => {
      setElapsedMs(payload.phase === 'running' ? payload.elapsedMs : 0);
    };
    s.on('query:progress', onProgress);
    return () => {
      s.off('query:progress', onProgress);
    };
  }, []);

  return (
    <div
      className={cn(
        'fixed z-40 box-border flex h-full w-full flex-col items-center justify-center gap-3 rounded-[4px] bg-white transition-opacity duration-100 ease-in',
        stateClassNames[phase],
        className,
      )}
      style={style}
      {...rest}
    >
      <Spinner aria-label={label ?? t('embed.loading')} className="size-10" />
      {elapsedMs > 0 && (
        <div className="text-xs text-[#555]">{t('common.queryRunning', { sec: Math.floor(elapsedMs / 1000) })}</div>
      )}
    </div>
  );
};

export default Loading;
