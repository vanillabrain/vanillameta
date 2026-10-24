import { useEffect, useState } from 'react';
import {
  AiUsage,
  fetchAiUsage,
  isAtLimit,
  limitReached,
  onAiUsageChanged,
  usageChipText,
  usageChipTitle,
} from '@/api/usageService';
import { useAiStatus } from '@/hooks/useAiStatus';

const REFRESH_MS = 60_000;

/**
 * How much of today's AI allowance is used. Renders nothing until the server has said. It reads on mount,
 * after something spent a call, and once a minute while the tab is visible: a hidden tab neither keeps the
 * session alive nor makes the server walk the user's directories for a number nobody sees.
 */
export default function AiUsageChip() {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const ai = useAiStatus();
  useEffect(() => {
    let alive = true;
    const read = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAiUsage().then(value => {
        if (alive && value) setUsage(value);
      });
    };
    read();
    const timer = setInterval(read, REFRESH_MS);
    const off = onAiUsageChanged(read);
    document.addEventListener('visibilitychange', read);
    return () => {
      alive = false;
      clearInterval(timer);
      off();
      document.removeEventListener('visibilitychange', read);
    };
  }, []);
  // No model is connected: a call counter for something that cannot be used is noise.
  if (!usage || ai?.configured === false) return null;
  return (
    <span className={`studio-usage${isAtLimit(usage) ? ' studio-usage-limit' : ''}`} title={usageChipTitle(usage)}>
      {usageChipText(usage)}
      {limitReached(usage) ? ` · ${limitReached(usage)} 한도 도달` : ''}
    </span>
  );
}
