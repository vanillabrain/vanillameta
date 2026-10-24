import { useEffect, useState } from 'react';
import { AiStatus, aiStatusLabel, loadAiStatus } from '@/api/aiStatus';

/** The configured model, or null until the server has answered. */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let alive = true;
    loadAiStatus().then(value => {
      if (alive) setStatus(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

/** "OpenAI · gpt-4o-mini" for a label next to a button that sends data to the model. */
export const useAiLabel = (): string => aiStatusLabel(useAiStatus());
