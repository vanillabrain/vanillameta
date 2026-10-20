import { useEffect, useState } from 'react';
import { classificationSession } from '@/api/classificationService';
/** Refresh/logout generations are owned by the existing auth boundary; registry state never crosses one. */
export function useClassificationSession() {
  const [session, setSession] = useState(classificationSession);
  useEffect(() => {
    const check = () => setSession(classificationSession());
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return session;
}
