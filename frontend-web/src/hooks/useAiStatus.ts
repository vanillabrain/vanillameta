import { useEffect, useState } from 'react';
import { AiStatus, aiStatusLabel, aiStatusNote, loadAiStatus } from '@/api/aiStatus';

/** The configured model, or null until the server has answered. */
export function useAiStatus(enabled = true): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    // `enabled` false: the screen does not offer AI, so it does not ask who the AI is.
    if (!enabled) return undefined;
    let alive = true;
    loadAiStatus().then(value => {
      if (alive) setStatus(value);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return status;
}

/** "OpenAI · gpt-4o-mini" for a label next to a button that sends data to the model. */
export const useAiLabel = (enabled = true): string => aiStatusLabel(useAiStatus(enabled));

/** " · AI가 아직 연결되지 않았습니다" when the server says no model is set up, else empty. */
export const useAiNote = (enabled = true): string => aiStatusNote(useAiStatus(enabled));
