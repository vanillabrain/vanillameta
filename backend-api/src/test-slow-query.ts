import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Connection } from 'typeorm';
import { getConnection } from 'typeorm';

/**
 * 슬로우 쿼리 모니터링 테스트 스크립트
 *
 * 사용법:
 * yarn ts-node src/test-slow-query.ts
 */
async function testSlowQueryMonitoring() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    console.log('🚀 슬로우 쿼리 모니터링 테스트 시작...\n');

    const connection = app.get(Connection);

    // 1. 빠른 쿼리 테스트 (인덱스 사용)
    console.log('1️⃣ 빠른 쿼리 실행 (인덱스 사용)');
    const fastQuery = `SELECT id, email FROM "user" WHERE id = 1`;
    const fastResult = await connection.query(fastQuery);
    console.log(`✅ 결과: ${fastResult.length}개 행 반환\n`);

    // 2. 느린 쿼리 시뮬레이션
    console.log('2️⃣ 느린 쿼리 실행 (pg_sleep 사용)');
    try {
      const slowQuery = `SELECT id, email, pg_sleep(2) AS delay FROM "user" LIMIT 5`;
      const slowResult = await connection.query(slowQuery);
      console.log(`✅ 결과: ${slowResult.length}개 행 반환 (2초 지연)\n`);
    } catch (error) {
      console.log('⚠️  PostgreSQL이 아니면 이 지연 쿼리를 실행하지 않습니다.\n');
    }

    // 3. 전체 테이블 스캔 쿼리
    console.log('3️⃣ 전체 테이블 스캔 쿼리');
    const fullScanQuery = `SELECT * FROM "user" WHERE email LIKE '%test%'`;
    const fullScanResult = await connection.query(fullScanQuery);
    console.log(`✅ 결과: ${fullScanResult.length}개 행 반환\n`);

    // 4. 복잡한 JOIN 쿼리
    console.log('4️⃣ 복잡한 JOIN 쿼리');
    const complexQuery = `
      SELECT 
        u.id,
        u.email,
        COUNT(d.id) as dashboard_count
      FROM "user" u
      LEFT JOIN dashboard d ON u.id = d."userId"
      GROUP BY u.id, u.email
      ORDER BY dashboard_count DESC
      LIMIT 10
    `;
    const complexResult = await connection.query(complexQuery);
    console.log(`✅ 결과: ${complexResult.length}개 행 반환\n`);

    // 5. 서브쿼리가 포함된 쿼리
    console.log('5️⃣ 서브쿼리가 포함된 쿼리');
    const subqueryQuery = `
      SELECT 
        id,
        email,
        (SELECT COUNT(*) FROM dashboard WHERE "userId" = "user".id) as dashboard_count
      FROM "user"
      WHERE "createdAt" > NOW() - INTERVAL '30 days'
    `;
    const subqueryResult = await connection.query(subqueryQuery);
    console.log(`✅ 결과: ${subqueryResult.length}개 행 반환\n`);

    // 6. 대량 데이터 정렬 쿼리
    console.log('6️⃣ 대량 데이터 정렬 쿼리');
    const sortQuery = `
      SELECT *
      FROM "user"
      ORDER BY "createdAt" DESC, email ASC
      LIMIT 100
    `;
    const sortResult = await connection.query(sortQuery);
    console.log(`✅ 결과: ${sortResult.length}개 행 반환\n`);

    console.log('🎉 테스트 완료!');
    console.log('\n💡 SlowQueryMonitorService를 통해 로그를 확인하세요:');
    console.log('   - CloudWatch Logs에서 "Slow query detected" 검색');
    console.log('   - API: GET /monitoring/slow-queries/stats');
    console.log('   - API: GET /monitoring/slow-queries');
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  } finally {
    await app.close();
  }
}

// 스크립트 실행
testSlowQueryMonitoring()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
