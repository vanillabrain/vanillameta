import { useEffect, useState } from 'react';
import { AiUsage, fetchAiUsage, isAtLimit, onAiUsageChanged, usageChipText, usageChipTitle } from '@/api/usageService';

const REFRESH_MS = 60_000;

/** How much of today's AI allowance is used. Renders nothing until the server has said. */
export default function AiUsageChip() {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      fetchAiUsage().then(value => {
        if (alive && value) setUsage(value);
      });
    read();
    const timer = setInterval(read, REFRESH_MS);
    const off = onAiUsageChanged(read);
    return () => {
      alive = false;
      clearInterval(timer);
      off();
    };
  }, []);
  if (!usage) return null;
  return (
    <span
      className={`studio-usage${isAtLimit(usage) ? ' studio-usage-limit' : ''}`}
      title={usageChipTitle(usage)}
      role="status"
      aria-label={`${usageChipText(usage)}. ${usageChipTitle(usage)}`}
    >
      {usageChipText(usage)}
    </span>
  );
}
