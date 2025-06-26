import { redirect } from 'next/navigation';

export default function HomePage() {
  // 홈페이지 접근 시 대시보드로 리다이렉트
  redirect('/dashboard');
}