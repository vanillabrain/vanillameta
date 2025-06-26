export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">대시보드</h1>
      <p className="text-muted-foreground">
        대시보드 페이지가 Next.js App Router로 마이그레이션되었습니다.
      </p>
      
      {/* 기존 Dashboard 컴포넌트를 점진적으로 통합 */}
      <div className="mt-8 p-4 border rounded-lg">
        <p>TODO: 기존 Dashboard 컴포넌트 통합</p>
      </div>
    </div>
  );
}