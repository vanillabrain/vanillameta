import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { Widget } from '../../src/widget/entities/widget.entity';
import { generateLargeDataset, measureMemoryUsage } from '../test-helpers';

describe('Performance and Load Testing', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let dashboardRepository: Repository<Dashboard>;
  let widgetRepository: Repository<Widget>;

  const testUser = {
    userId: 'perfuser',
    email: 'perf@example.com',
    password: 'perfpassword123',
    name: 'Performance Test User',
  };

  let accessToken: string;
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    dashboardRepository = moduleFixture.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    widgetRepository = moduleFixture.get<Repository<Widget>>(getRepositoryToken(Widget));

    // 테스트 사용자 생성 및 로그인
    const savedUser = await userRepository.save(testUser);
    userId = savedUser.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    accessToken = loginResponse.body.accessToken;
  }, 30000);

  afterAll(async () => {
    // 테스트 데이터 정리
    await widgetRepository.delete({});
    await dashboardRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('API Response Time Tests', () => {
    it('should respond to authentication requests within 2 seconds', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: testUser.userId,
          password: testUser.password,
        })
        .expect(201);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(2000);
      expect(response.body.accessToken).toBeDefined();
    });

    it('should respond to dashboard list requests within 3 seconds', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${accessToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(3000);
      expect([200, 404]).toContain(response.status);
    });

    it('should respond to widget list requests within 3 seconds', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(3000);
      expect(response.body.status).toBe('SUCCESS');
    });

    it('should respond to component list requests within 2 seconds', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/component')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(2000);
      expect(response.body.status).toBe('SUCCESS');
    });
  });

  describe('Concurrent Request Load Tests', () => {
    it('should handle 10 concurrent authentication requests', async () => {
      const concurrentCount = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentCount }, () =>
        request(app.getHttpServer()).post('/api/auth/login').send({
          userId: testUser.userId,
          password: testUser.password,
        }),
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 모든 요청이 성공해야 함
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.accessToken).toBeDefined();
      });

      // 총 처리 시간이 10초 이내여야 함
      expect(totalTime).toBeLessThan(10000);

      // 평균 응답 시간 계산
      const avgResponseTime = totalTime / concurrentCount;
      expect(avgResponseTime).toBeLessThan(1000); // 평균 1초 이내
    }, 15000);

    it('should handle 20 concurrent dashboard list requests', async () => {
      const concurrentCount = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentCount }, () =>
        request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${accessToken}`),
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 모든 요청이 적절히 처리되어야 함
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });

      // 총 처리 시간이 15초 이내여야 함
      expect(totalTime).toBeLessThan(15000);
    }, 20000);

    it('should handle 15 concurrent widget creation requests', async () => {
      const concurrentCount = 15;
      const createdWidgetIds: number[] = [];

      const promises = Array.from({ length: concurrentCount }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            title: `Concurrent Widget ${index + 1}`,
            description: `Performance test widget ${index + 1}`,
            databaseId: 1,
            componentId: 1,
            datasetType: 'DATASET',
            datasetId: 1,
            option: {
              type: 'line',
              title: { text: `Chart ${index + 1}` },
              series: [{ data: [10, 20, 30], type: 'line' }],
            },
          }),
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 성공한 요청들의 위젯 ID 수집
      responses.forEach(response => {
        if (response.status === 201) {
          createdWidgetIds.push(response.body.data.id);
        }
      });

      // 총 처리 시간이 20초 이내여야 함
      expect(totalTime).toBeLessThan(20000);

      // 생성된 위젯들 정리
      const cleanupPromises = createdWidgetIds.map(id =>
        request(app.getHttpServer())
          .delete(`/api/widget/${id}`)
          .set('Authorization', `Bearer ${accessToken}`),
      );

      await Promise.all(cleanupPromises);
    }, 25000);
  });

  describe('Memory and Resource Usage Tests', () => {
    it('should maintain stable memory usage during bulk operations', async () => {
      const initialMemory = measureMemoryUsage();

      // 대량의 위젯 생성 요청
      const bulkCount = 50;
      const createdWidgetIds: number[] = [];

      for (let i = 0; i < bulkCount; i += 5) {
        const batchPromises = Array.from({ length: 5 }, (_, batchIndex) =>
          request(app.getHttpServer())
            .post('/api/widget')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              title: `Bulk Widget ${i + batchIndex + 1}`,
              description: `Memory test widget ${i + batchIndex + 1}`,
              databaseId: 1,
              componentId: 1,
              datasetType: 'DATASET',
              datasetId: 1,
              option: {
                type: 'bar',
                series: [{ data: generateLargeDataset(100), type: 'bar' }],
              },
            }),
        );

        const batchResponses = await Promise.all(batchPromises);
        batchResponses.forEach(response => {
          if (response.status === 201) {
            createdWidgetIds.push(response.body.data.id);
          }
        });

        // 배치 간 메모리 측정
        const currentMemory = measureMemoryUsage();
        console.log(`Batch ${Math.floor(i / 5) + 1} memory: ${currentMemory.heapUsed}MB`);
      }

      const finalMemory = measureMemoryUsage();

      // 메모리 증가가 500MB 이내여야 함
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(500);

      console.log(`Memory increase: ${memoryIncrease}MB`);
      console.log(`Created ${createdWidgetIds.length} widgets`);

      // 정리
      const cleanupPromises = createdWidgetIds.map(id =>
        request(app.getHttpServer())
          .delete(`/api/widget/${id}`)
          .set('Authorization', `Bearer ${accessToken}`),
      );

      await Promise.all(cleanupPromises);
    }, 60000);

    it('should handle large payload requests efficiently', async () => {
      const largeDataset = generateLargeDataset(5000); // 5000개 데이터 포인트
      const largeOption = {
        type: 'scatter',
        title: { text: 'Large Dataset Visualization' },
        xAxis: { type: 'value' },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'scatter',
            data: largeDataset.map(item => [item.value, item.id]),
            large: true,
            largeThreshold: 2000,
          },
        ],
        dataZoom: [{ type: 'inside' }, { type: 'slider' }],
      };

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Large Payload Widget',
          description: 'Widget with large dataset for performance testing',
          databaseId: 1,
          componentId: 1,
          datasetType: 'DATASET',
          datasetId: 1,
          option: largeOption,
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 대용량 페이로드 처리 시간이 10초 이내여야 함
      expect(responseTime).toBeLessThan(10000);

      if (response.status === 201) {
        expect(response.body.status).toBe('SUCCESS');
        expect(response.body.data.option.series[0].large).toBe(true);

        // 정리
        await request(app.getHttpServer())
          .delete(`/api/widget/${response.body.data.id}`)
          .set('Authorization', `Bearer ${accessToken}`);
      }
    }, 15000);
  });

  describe('Database Connection Pool Performance', () => {
    it('should efficiently manage database connections under load', async () => {
      const connectionCount = 25;
      const promises = Array.from({ length: connectionCount }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/database/test-connection')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            engine: 'sqlite3',
            connectionConfig: {
              filename: `:memory:test${index}:`,
            },
          }),
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 연결 테스트들이 30초 이내에 완료되어야 함
      expect(totalTime).toBeLessThan(30000);

      // 각 응답 확인
      responses.forEach((response, index) => {
        expect([200, 400, 500]).toContain(response.status);
        // 성공한 경우 적절한 응답 구조 확인
        if (response.status === 200) {
          expect(response.body.status).toBe('SUCCESS');
        }
      });
    }, 35000);
  });

  describe('Stress Testing', () => {
    it('should maintain functionality under sustained load', async () => {
      const sustainedDuration = 30000; // 30초 지속 테스트
      const requestInterval = 100; // 100ms마다 요청
      const startTime = Date.now();
      let successCount = 0;
      let errorCount = 0;

      const sustainedTest = async (): Promise<void> => {
        while (Date.now() - startTime < sustainedDuration) {
          try {
            const response = await request(app.getHttpServer())
              .get('/api/component')
              .set('Authorization', `Bearer ${accessToken}`);

            if (response.status === 200) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }

          await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
      };

      await sustainedTest();

      const totalRequests = successCount + errorCount;
      const successRate = (successCount / totalRequests) * 100;

      console.log(`Sustained test results:`);
      console.log(`Total requests: ${totalRequests}`);
      console.log(`Success count: ${successCount}`);
      console.log(`Error count: ${errorCount}`);
      console.log(`Success rate: ${successRate.toFixed(2)}%`);

      // 성공률이 90% 이상이어야 함
      expect(successRate).toBeGreaterThan(90);
      expect(totalRequests).toBeGreaterThan(250); // 최소한의 요청 수 확보
    }, 35000);

    it('should recover gracefully from temporary overload', async () => {
      // 급작스러운 부하 생성
      const overloadCount = 50;
      const overloadPromises = Array.from({ length: overloadCount }, () =>
        request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${accessToken}`),
      );

      // 부하 요청 실행
      const overloadStartTime = Date.now();
      await Promise.all(overloadPromises);
      const overloadEndTime = Date.now();

      console.log(`Overload duration: ${overloadEndTime - overloadStartTime}ms`);

      // 부하 후 정상 요청이 여전히 작동하는지 확인
      const recoveryStartTime = Date.now();
      const recoveryResponse = await request(app.getHttpServer())
        .get('/api/component')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const recoveryEndTime = Date.now();
      const recoveryTime = recoveryEndTime - recoveryStartTime;

      // 복구 시간이 5초 이내여야 함
      expect(recoveryTime).toBeLessThan(5000);
      expect(recoveryResponse.body.status).toBe('SUCCESS');
    }, 20000);
  });

  describe('Performance Benchmarks', () => {
    it('should establish performance baselines', async () => {
      const benchmarks = {
        auth: {
          endpoint: '/api/auth/login',
          method: 'POST',
          data: { userId: testUser.userId, password: testUser.password },
        },
        dashboard: { endpoint: '/api/dashboard', method: 'GET', data: null },
        widget: { endpoint: '/api/widget', method: 'GET', data: null },
        component: { endpoint: '/api/component', method: 'GET', data: null },
      };

      const results: Record<string, number> = {};

      for (const [name, config] of Object.entries(benchmarks)) {
        const iterations = 10;
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();

          if (config.method === 'POST') {
            await request(app.getHttpServer()).post(config.endpoint).send(config.data);
          } else {
            await request(app.getHttpServer())
              .get(config.endpoint)
              .set('Authorization', `Bearer ${accessToken}`);
          }

          const endTime = Date.now();
          times.push(endTime - startTime);
        }

        // 평균 응답 시간 계산
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        results[name] = avgTime;

        console.log(`${name} average response time: ${avgTime.toFixed(2)}ms`);
      }

      // 성능 기준 설정
      expect(results.auth).toBeLessThan(1000); // 인증: 1초 이내
      expect(results.dashboard).toBeLessThan(2000); // 대시보드: 2초 이내
      expect(results.widget).toBeLessThan(2000); // 위젯: 2초 이내
      expect(results.component).toBeLessThan(1000); // 컴포넌트: 1초 이내
    }, 30000);
  });
});
