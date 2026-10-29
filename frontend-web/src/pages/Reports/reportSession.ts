import { useEffect, useState } from 'react';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
export function useReportSession() {
  const [scope, setScope] = useState(personalLibrarySessionScope);
  useEffect(() => {
    const sync = () => setScope(personalLibrarySessionScope());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    sync();
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  return scope;
}
export const isReportSession = (scope: string) => scope !== null && personalLibrarySessionScope() === scope;
