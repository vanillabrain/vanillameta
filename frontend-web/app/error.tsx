'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 로깅
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-red-600">오류가 발생했습니다</h1>
        <p className="text-muted-foreground">
          예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 p-4 bg-red-50 rounded-lg text-left">
            <summary className="cursor-pointer font-semibold">
              개발자 정보 (개발 모드)
            </summary>
            <pre className="mt-2 text-sm text-red-800">
              {error.message}
              {error.stack && '\n' + error.stack}
            </pre>
          </details>
        )}
        <div className="space-x-2">
          <Button onClick={() => reset()}>다시 시도</Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            홈으로 이동
          </Button>
        </div>
      </div>
    </div>
  );
}