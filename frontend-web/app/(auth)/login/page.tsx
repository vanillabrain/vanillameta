'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/mui-textfield-compat';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // TODO: 실제 로그인 API 호출
      console.log('Login attempt:', { email, password });
      
      // 임시로 대시보드로 리다이렉트
      router.push('/dashboard');
    } catch (err) {
      setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">VanillaMeta</h2>
        <p className="mt-2 text-sm text-gray-600">
          계정에 로그인하세요
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <TextField
          label="이메일"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          autoComplete="email"
        />

        <TextField
          label="비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 text-primary border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-900">
              로그인 상태 유지
            </span>
          </label>

          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </Button>

        <div className="text-center text-sm">
          <span className="text-gray-600">계정이 없으신가요? </span>
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            회원가입
          </Link>
        </div>
      </form>
    </div>
  );
}