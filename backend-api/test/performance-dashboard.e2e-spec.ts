import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/user/entities/user.entity';
import { Dashboard } from '../src/dashboard/entities/dashboard.entity';
import { Repository } from 'typeorm';
import { 
  performanceThresholds, 
  performanceHelpers,
  generateLargeDataset,
  TestDataBuilder,
  measureMemoryUsage 
} from './test-helpers';

describe('Dashboard Performance Tests (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let dashboardRepository: Repository<Dashboard>;
  let authToken: string;
  let userRecord: User;

  const testUser = {
    userId: 'perfuser',
    email: 'perf@example.com',
    password: 'perfpassword123',
    name: 'Performance Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    dashboardRepository = moduleFixture.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));

    // 테스트 사용자 생성
    userRecord = await userRepository.save(testUser);

    // 인증 토큰 획득
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await dashboardRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('Load Testing', () => {
    it('should handle creation of multiple dashboards within performance threshold', async () => {
      const dashboardCount = 50;
      const createPromises = [];

      const startTime = Date.now();
      const initialMemory = measureMemoryUsage();

      for (let i = 0; i < dashboardCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Performance Dashboard ${i + 1}`,
            layout: [
              { i: `widget${i}_1`, x: 0, y: 0, w: 6, h: 4 },
              { i: `widget${i}_2`, x: 6, y: 0, w: 6, h: 4 },
            ],
          });
        createPromises.push(promise);
      }

      const responses = await Promise.all(createPromises);
      const executionTime = Date.now() - startTime;
      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // 모든 요청이 성공했는지 확인
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('SUCCESS');
      });

      // 성능 임계값 확인
      expect(executionTime).toBeLessThan(dashboardCount * performanceThresholds.apiResponseTime);
      expect(memoryIncrease).toBeLessThan(performanceThresholds.memoryUsageIncrease);

      console.log(`Created ${dashboardCount} dashboards in ${executionTime}ms`);
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });

    it('should handle listing large number of dashboards efficiently', async () => {
      const { result, executionTime } = await performanceHelpers.measureExecutionTime(async () => {
        return await request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      });

      expect(executionTime).toBeLessThan(performanceThresholds.apiResponseTime * 2);
      expect(result.body.status).toBe('SUCCESS');
      expect(result.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Stress Testing', () => {
    it('should handle dashboard with extremely large layout', async () => {
      const widgetCount = 100;
      const largeLayout = Array.from({ length: widgetCount }, (_, i) => ({
        i: `stressWidget${i}`,
        x: (i % 12) * 1,
        y: Math.floor(i / 12) * 1,
        w: 1,
        h: 1,
      }));

      const { result, executionTime } = await performanceHelpers.measureExecutionTime(async () => {
        return await request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Stress Test Dashboard',
            layout: largeLayout,
          });
      });

      expect(result.status).toBe(201);
      expect(result.body.status).toBe('SUCCESS');
      expect(result.body.data.layout).toHaveLength(widgetCount);
      expect(executionTime).toBeLessThan(performanceThresholds.apiResponseTime * 3);
    });

    it('should handle rapid sequential updates', async () => {
      // 먼저 대시보드 생성
      const createResponse = await request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Rapid Update Dashboard',
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        })
        .expect(201);

      const dashboardId = createResponse.body.data.id;

      // 연속적인 업데이트 수행
      const updateCount = 20;
      const updatePromises = [];

      const startTime = Date.now();

      for (let i = 0; i < updateCount; i++) {
        const promise = request(app.getHttpServer())
          .put(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Updated Title ${i + 1}`,
            layout: [
              { i: `widget${i + 1}`, x: i % 6, y: Math.floor(i / 6), w: 2, h: 2 },
            ],
          });
        updatePromises.push(promise);
        
        // 약간의 딜레이를 추가하여 실제 사용 패턴 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const responses = await Promise.all(updatePromises);
      const executionTime = Date.now() - startTime;

      // 모든 업데이트가 성공했는지 확인
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        if (response.body.status) {
          expect(response.body.status).toBe('SUCCESS');
        }
      });

      expect(executionTime).toBeLessThan(updateCount * performanceThresholds.apiResponseTime);
    });
  });

  describe('Concurrent User Simulation', () => {
    it('should handle multiple users accessing dashboards simultaneously', async () => {
      // 여러 사용자 생성
      const userCount = 5;
      const users = [];
      const tokens = [];

      for (let i = 0; i < userCount; i++) {
        const user = {
          userId: `concurrentuser${i}`,
          email: `concurrent${i}@example.com`,
          password: 'password123',
          name: `Concurrent User ${i}`,
        };

        const savedUser = await userRepository.save(user);
        users.push(savedUser);

        const loginResponse = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: user.userId,
            password: user.password,
          })
          .expect(201);

        tokens.push(loginResponse.body.accessToken);
      }

      // 각 사용자가 동시에 대시보드 작업 수행
      const operations = tokens.map((token, index) => async () => {
        // 대시보드 생성
        const createResponse = await request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `User ${index} Dashboard`,
            layout: [{ i: `widget_user${index}`, x: 0, y: 0, w: 6, h: 4 }],
          });

        const dashboardId = createResponse.body.data.id;

        // 대시보드 조회
        await request(app.getHttpServer())
          .get(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // 대시보드 업데이트
        await request(app.getHttpServer())
          .put(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Updated User ${index} Dashboard`,
          })
          .expect(200);

        return dashboardId;
      });

      const { results, totalExecutionTime, averageTime } = 
        await performanceHelpers.measureConcurrentExecution(operations, userCount);

      expect(results).toHaveLength(userCount);
      expect(averageTime).toBeLessThan(performanceThresholds.apiResponseTime * 3);

      console.log(`Concurrent operations completed in ${totalExecutionTime}ms`);
      console.log(`Average time per user: ${averageTime.toFixed(2)}ms`);

      // 정리
      for (const user of users) {
        await userRepository.delete(user.id);
      }
    });
  });

  describe('Memory Efficiency Tests', () => {
    it('should not leak memory during repeated dashboard operations', async () => {
      const iterations = 10;
      const memorySnapshots = [];

      for (let i = 0; i < iterations; i++) {
        const beforeMemory = measureMemoryUsage();

        // 대시보드 생성
        const createResponse = await request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Memory Test Dashboard ${i}`,
            layout: generateLargeDataset(10).map((item, idx) => ({
              i: `widget_${idx}`,
              x: idx % 4 * 3,
              y: Math.floor(idx / 4) * 2,
              w: 3,
              h: 2,
            })),
          })
          .expect(201);

        const dashboardId = createResponse.body.data.id;

        // 대시보드 조회
        await request(app.getHttpServer())
          .get(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // 대시보드 삭제
        await request(app.getHttpServer())
          .delete(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const afterMemory = measureMemoryUsage();
        memorySnapshots.push({
          iteration: i,
          heapUsed: afterMemory.heapUsed,
          increase: afterMemory.heapUsed - beforeMemory.heapUsed,
        });

        // 가비지 컬렉션을 위한 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 메모리 사용량이 지속적으로 증가하지 않는지 확인
      const avgIncrease = memorySnapshots.reduce((sum, snap) => sum + snap.increase, 0) / iterations;
      expect(avgIncrease).toBeLessThan(5); // 평균 5MB 미만의 증가

      console.log('Memory usage over iterations:');
      memorySnapshots.forEach(snap => {
        console.log(`Iteration ${snap.iteration}: ${snap.heapUsed.toFixed(2)}MB (increase: ${snap.increase.toFixed(2)}MB)`);
      });
    });
  });

  describe('Data Volume Tests', () => {
    it('should handle dashboard with maximum practical data size', async () => {
      const builder = new TestDataBuilder<any>();
      
      // 매우 큰 레이아웃 데이터 생성 (실제 사용 케이스의 상한선)
      const maxWidgets = 200;
      const complexLayout = builder.buildMany(maxWidgets, (i) => ({
        i: `w${i}`,
        x: (i % 24) * 0.5,
        y: Math.floor(i / 24) * 0.5,
        w: 0.5,
        h: 0.5,
        minW: 0.5,
        minH: 0.5,
        maxW: 12,
        maxH: 12,
        moved: false,
        static: false,
        isDraggable: true,
        isResizable: true,
        resizeHandles: ['se'],
        isBounded: true,
      }));

      const longTitle = 'A'.repeat(255); // 최대 길이 제목
      const longDescription = 'This is a test dashboard with maximum data. '.repeat(50);

      const { result, executionTime, memoryIncrease } = await performanceHelpers.measureMemoryIncrease(
        async () => {
          return await request(app.getHttpServer())
            .post('/api/dashboard')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: longTitle,
              layout: complexLayout,
              description: longDescription, // 추가 데이터
            });
        }
      );

      expect(result.status).toBe(201);
      expect(result.body.status).toBe('SUCCESS');
      expect(executionTime).toBeLessThan(performanceThresholds.apiResponseTime * 5);
      expect(memoryIncrease).toBeLessThan(performanceThresholds.memoryUsageIncrease * 2);

      console.log(`Created dashboard with ${maxWidgets} widgets in ${executionTime}ms`);
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });
  });
});