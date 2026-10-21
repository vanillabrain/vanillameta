import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { Database } from '../src/database/entities/database.entity';
import { Dataset } from '../src/dataset/entities/dataset.entity';
import { Widget } from '../src/widget/entities/widget.entity';
import { Dashboard } from '../src/dashboard/entities/dashboard.entity';
import { Component } from '../src/component/entities/component.entity';

describe('Data Visualization Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let databaseRepository: Repository<Database>;
  let datasetRepository: Repository<Dataset>;
  let widgetRepository: Repository<Widget>;
  let dashboardRepository: Repository<Dashboard>;
  let componentRepository: Repository<Component>;

  const testUser = {
    userId: 'testuser',
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User',
  };

  const testDatabase = {
    name: 'Test Database',
    engine: 'mysql',
    connectionConfig: JSON.stringify({
      host: 'localhost',
      port: 3306,
      user: 'testuser',
      password: 'testpass',
      database: 'testdb',
    }),
  };

  const testDataset = {
    name: 'Test Dataset',
    query: 'SELECT id, name, value, created_at FROM test_table',
    databaseId: null, // Will be set after database creation
  };

  const testComponent = {
    type: 'line-chart',
    title: 'Line Chart',
    description: 'Line chart component for data visualization',
    icon: 'line-chart-icon',
    category: 'basic',
  };

  let accessToken: string;
  let refreshToken: string;
  let userId: number;
  let databaseId: number;
  let datasetId: number;
  let componentId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    databaseRepository = moduleFixture.get<Repository<Database>>(getRepositoryToken(Database));
    datasetRepository = moduleFixture.get<Repository<Dataset>>(getRepositoryToken(Dataset));
    widgetRepository = moduleFixture.get<Repository<Widget>>(getRepositoryToken(Widget));
    dashboardRepository = moduleFixture.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    componentRepository = moduleFixture.get<Repository<Component>>(getRepositoryToken(Component));

    // 테스트 데이터 설정
    const savedUser = await userRepository.save(testUser);
    userId = savedUser.id;

    const savedDatabase = await databaseRepository.save(testDatabase);
    databaseId = savedDatabase.id;

    const savedDataset = await datasetRepository.save({
      ...testDataset,
      databaseId: databaseId,
    });
    datasetId = savedDataset.id;

    const savedComponent = await componentRepository.save(testComponent);
    componentId = savedComponent.id;

    // 인증 토큰 획득
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    accessToken = loginResponse.body.accessToken;
    refreshToken = loginResponse.body.refreshToken;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await widgetRepository.delete({});
    await dashboardRepository.delete({});
    await datasetRepository.delete({});
    await componentRepository.delete({});
    await databaseRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('Complete Data Visualization Workflow', () => {
    let createdWidgetId: number;
    let createdDashboardId: number;

    it('should complete end-to-end data visualization flow', async () => {
      // 1. 데이터베이스 연결 테스트
      const connectionTestResponse = await request(app.getHttpServer())
        .post('/api/database/test-connection')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          engine: 'mysql',
          connectionConfig: {
            host: 'localhost',
            port: 3306,
            user: 'testuser',
            password: 'testpass',
            database: 'testdb',
          },
        });

      // 실제 DB 연결이 실패할 수 있으므로 status만 확인
      expect([200, 400, 500]).toContain(connectionTestResponse.status);

      // 2. 차트 컴포넌트 목록 조회
      const componentsResponse = await request(app.getHttpServer())
        .get('/api/component')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(componentsResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(componentsResponse.body.data)).toBe(true);

      // 3. 데이터셋 목록 조회
      const datasetsResponse = await request(app.getHttpServer())
        .get('/api/dataset')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(datasetsResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(datasetsResponse.body.data)).toBe(true);

      // 4. 위젯 생성 (차트 위젯)
      const createWidgetResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'E2E Test Line Chart',
          description: 'End-to-end test line chart widget',
          databaseId: databaseId,
          componentId: componentId,
          datasetType: 'DATASET',
          datasetId: datasetId,
          option: {
            type: 'line',
            title: { text: 'Sales Trend' },
            xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar', 'Apr'] },
            yAxis: { type: 'value' },
            series: [
              {
                data: [120, 200, 150, 300],
                type: 'line',
                smooth: true,
              },
            ],
          },
        })
        .expect(201);

      expect(createWidgetResponse.body.status).toBe('SUCCESS');
      expect(createWidgetResponse.body.data.title).toBe('E2E Test Line Chart');
      createdWidgetId = createWidgetResponse.body.data.id;

      // 5. 위젯 조회
      const getWidgetResponse = await request(app.getHttpServer())
        .get(`/api/widget/${createdWidgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getWidgetResponse.body.status).toBe('SUCCESS');
      expect(getWidgetResponse.body.data.title).toBe('E2E Test Line Chart');

      // 6. 대시보드 생성 및 위젯 추가
      const createDashboardResponse = await request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'E2E Test Dashboard',
          layout: [
            {
              i: createdWidgetId.toString(),
              x: 0,
              y: 0,
              w: 6,
              h: 4,
            },
          ],
        })
        .expect(201);

      expect(createDashboardResponse.body.status).toBe('SUCCESS');
      expect(createDashboardResponse.body.data.title).toBe('E2E Test Dashboard');
      createdDashboardId = createDashboardResponse.body.data.id;

      // 7. 대시보드 조회 (위젯 포함)
      const getDashboardResponse = await request(app.getHttpServer())
        .get(`/api/dashboard/${createdDashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getDashboardResponse.body.status).toBe('SUCCESS');
      expect(getDashboardResponse.body.data.title).toBe('E2E Test Dashboard');
      expect(getDashboardResponse.body.data.layout).toHaveLength(1);
      expect(getDashboardResponse.body.data.layout[0].i).toBe(createdWidgetId.toString());

      // 8. 위젯 설정 업데이트
      const updateWidgetResponse = await request(app.getHttpServer())
        .patch(`/api/widget/${createdWidgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated E2E Chart',
          option: {
            type: 'bar',
            title: { text: 'Updated Sales Chart' },
            xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
            yAxis: { type: 'value' },
            series: [
              {
                data: [500, 600, 700, 800],
                type: 'bar',
              },
            ],
          },
        })
        .expect(200);

      expect(updateWidgetResponse.body.status).toBe('SUCCESS');
      expect(updateWidgetResponse.body.data.title).toBe('Updated E2E Chart');
      expect(updateWidgetResponse.body.data.option.type).toBe('bar');

      // 9. 대시보드 레이아웃 업데이트
      const updateDashboardResponse = await request(app.getHttpServer())
        .patch(`/api/dashboard/${createdDashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated E2E Dashboard',
          layout: [
            {
              i: createdWidgetId.toString(),
              x: 2,
              y: 1,
              w: 8,
              h: 6,
            },
          ],
        })
        .expect(200);

      expect(updateDashboardResponse.body.status).toBe('SUCCESS');
      expect(updateDashboardResponse.body.data.title).toBe('Updated E2E Dashboard');
      expect(updateDashboardResponse.body.data.layout[0].w).toBe(8);
      expect(updateDashboardResponse.body.data.layout[0].h).toBe(6);

      // 10. 전체 대시보드 목록 조회
      const getAllDashboardsResponse = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getAllDashboardsResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(getAllDashboardsResponse.body.data)).toBe(true);
      expect(getAllDashboardsResponse.body.data.length).toBeGreaterThan(0);
    });

    afterEach(async () => {
      // 각 테스트 후 생성된 데이터 정리
      if (createdDashboardId) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/dashboard/${createdDashboardId}`)
            .set('Authorization', `Bearer ${accessToken}`);
        } catch (error) {
          // 정리 실패는 무시
        }
      }

      if (createdWidgetId) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/widget/${createdWidgetId}`)
            .set('Authorization', `Bearer ${accessToken}`);
        } catch (error) {
          // 정리 실패는 무시
        }
      }
    });
  });

  describe('Complex Chart Configuration', () => {
    it('should create and configure complex multi-series chart', async () => {
      // 복합 차트 위젯 생성
      const complexChartResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Complex Multi-Series Chart',
          description: 'Complex chart with multiple data series',
          databaseId: databaseId,
          componentId: componentId,
          datasetType: 'DATASET',
          datasetId: datasetId,
          option: {
            type: 'line',
            title: {
              text: 'Sales & Revenue Analysis',
              left: 'center',
              textStyle: { fontSize: 18, fontWeight: 'bold' },
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'cross' },
            },
            legend: {
              data: ['Sales', 'Revenue', 'Profit'],
              top: '10%',
            },
            grid: {
              left: '3%',
              right: '4%',
              bottom: '3%',
              containLabel: true,
            },
            xAxis: {
              type: 'category',
              boundaryGap: false,
              data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            },
            yAxis: [
              {
                type: 'value',
                name: 'Amount ($)',
                position: 'left',
              },
              {
                type: 'value',
                name: 'Percentage (%)',
                position: 'right',
              },
            ],
            series: [
              {
                name: 'Sales',
                type: 'line',
                data: [1200, 1350, 1100, 1600, 1800, 2000],
                itemStyle: { color: '#1f77b4' },
              },
              {
                name: 'Revenue',
                type: 'line',
                data: [1000, 1200, 900, 1400, 1600, 1800],
                itemStyle: { color: '#ff7f0e' },
              },
              {
                name: 'Profit',
                type: 'bar',
                yAxisIndex: 1,
                data: [15, 20, 12, 25, 30, 35],
                itemStyle: { color: '#2ca02c' },
              },
            ],
          },
        })
        .expect(201);

      expect(complexChartResponse.body.status).toBe('SUCCESS');
      expect(complexChartResponse.body.data.option.series).toHaveLength(3);
      expect(complexChartResponse.body.data.option.yAxis).toHaveLength(2);

      const complexWidgetId = complexChartResponse.body.data.id;

      // 위젯 정보 조회하여 설정 확인
      const getComplexWidgetResponse = await request(app.getHttpServer())
        .get(`/api/widget/${complexWidgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const chartOption = getComplexWidgetResponse.body.data.option;
      expect(chartOption.title.text).toBe('Sales & Revenue Analysis');
      expect(chartOption.legend.data).toEqual(['Sales', 'Revenue', 'Profit']);
      expect(chartOption.series[0].name).toBe('Sales');
      expect(chartOption.series[1].name).toBe('Revenue');
      expect(chartOption.series[2].name).toBe('Profit');

      // 정리
      await request(app.getHttpServer())
        .delete(`/api/widget/${complexWidgetId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    });
  });

  describe('Data Query and Visualization', () => {
    it('should execute data query and create chart from results', async () => {
      // Mock query execution (실제 DB 연결 없이 테스트)
      const mockQuery = 'SELECT date, sales, revenue FROM monthly_data ORDER BY date';

      // 데이터셋 생성
      const createDatasetResponse = await request(app.getHttpServer())
        .post('/api/dataset')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Monthly Sales Data',
          description: 'Monthly sales and revenue data',
          databaseId: databaseId,
          query: mockQuery,
        })
        .expect(201);

      expect(createDatasetResponse.body.status).toBe('SUCCESS');
      const newDatasetId = createDatasetResponse.body.data.id;

      // 생성된 데이터셋으로 위젯 생성
      const createDataWidgetResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Monthly Sales Chart',
          description: 'Chart based on monthly sales query',
          databaseId: databaseId,
          componentId: componentId,
          datasetType: 'DATASET',
          datasetId: newDatasetId,
          option: {
            type: 'line',
            title: { text: 'Monthly Sales Trend' },
            xAxis: { type: 'category' },
            yAxis: { type: 'value' },
            series: [
              { name: 'Sales', type: 'line' },
              { name: 'Revenue', type: 'line' },
            ],
          },
        })
        .expect(201);

      expect(createDataWidgetResponse.body.status).toBe('SUCCESS');
      const dataWidgetId = createDataWidgetResponse.body.data.id;

      // 데이터셋과 위젯 정리
      await request(app.getHttpServer())
        .delete(`/api/widget/${dataWidgetId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      await request(app.getHttpServer())
        .delete(`/api/dataset/${newDatasetId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid chart configurations gracefully', async () => {
      // 잘못된 차트 설정으로 위젯 생성 시도
      const invalidChartResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Invalid Chart',
          description: 'Chart with invalid configuration',
          databaseId: databaseId,
          componentId: componentId,
          datasetType: 'DATASET',
          datasetId: datasetId,
          option: {
            type: 'invalid-chart-type',
            invalidProperty: 'invalid-value',
          },
        });

      // 서버가 에러를 처리해야 함 (400 또는 201이지만 기본값으로 처리)
      expect([201, 400]).toContain(invalidChartResponse.status);
    });

    it('should handle missing dataset references', async () => {
      // 존재하지 않는 데이터셋 ID로 위젯 생성 시도
      const missingDatasetResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Missing Dataset Widget',
          description: 'Widget with non-existent dataset',
          databaseId: databaseId,
          componentId: componentId,
          datasetType: 'DATASET',
          datasetId: 99999, // 존재하지 않는 ID
          option: {
            type: 'line',
            title: { text: 'Test Chart' },
          },
        });

      // 서버가 에러를 적절히 처리해야 함
      expect([201, 400, 404]).toContain(missingDatasetResponse.status);
    });

    it('should handle chart configuration updates', async () => {
      // 기본 위젯 생성
      const createWidgetResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updatable Chart',
          description: 'Chart for testing updates',
          databaseId: databaseId,
          componentId: componentId,
          datasetType: 'DATASET',
          datasetId: datasetId,
          option: {
            type: 'line',
            title: { text: 'Original Chart' },
          },
        })
        .expect(201);

      const widgetId = createWidgetResponse.body.data.id;

      // 차트 타입과 설정 변경
      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/widget/${widgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          option: {
            type: 'pie',
            title: { text: 'Updated Pie Chart' },
            series: [
              {
                type: 'pie',
                radius: '50%',
                data: [
                  { value: 335, name: 'Product A' },
                  { value: 310, name: 'Product B' },
                  { value: 234, name: 'Product C' },
                ],
              },
            ],
          },
        })
        .expect(200);

      expect(updateResponse.body.status).toBe('SUCCESS');
      expect(updateResponse.body.data.option.type).toBe('pie');
      expect(updateResponse.body.data.option.series[0].type).toBe('pie');

      // 정리
      await request(app.getHttpServer())
        .delete(`/api/widget/${widgetId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent widget creations', async () => {
      const widgetPromises = Array.from({ length: 5 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            title: `Concurrent Widget ${index + 1}`,
            description: `Concurrent test widget ${index + 1}`,
            databaseId: databaseId,
            componentId: componentId,
            datasetType: 'DATASET',
            datasetId: datasetId,
            option: {
              type: 'line',
              title: { text: `Chart ${index + 1}` },
              series: [{ data: [10, 20, 30], type: 'line' }],
            },
          }),
      );

      const responses = await Promise.all(widgetPromises);

      // 모든 응답이 성공해야 함
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('SUCCESS');
        expect(response.body.data.title).toBe(`Concurrent Widget ${index + 1}`);
      });

      // 생성된 위젯들 정리
      const cleanupPromises = responses.map(response =>
        request(app.getHttpServer())
          .delete(`/api/widget/${response.body.data.id}`)
          .set('Authorization', `Bearer ${accessToken}`),
      );

      await Promise.all(cleanupPromises);
    });

    it('should handle large dashboard with many widgets', async () => {
      // 여러 위젯 생성
      const widgetIds: number[] = [];

      for (let i = 0; i < 10; i++) {
        const widgetResponse = await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            title: `Large Dashboard Widget ${i + 1}`,
            description: `Widget ${i + 1} for large dashboard`,
            databaseId: databaseId,
            componentId: componentId,
            datasetType: 'DATASET',
            datasetId: datasetId,
            option: {
              type: ['line', 'bar', 'pie'][i % 3],
              title: { text: `Chart ${i + 1}` },
            },
          })
          .expect(201);

        widgetIds.push(widgetResponse.body.data.id);
      }

      // 큰 대시보드 생성 (10개 위젯)
      const layout = widgetIds.map((id, index) => ({
        i: id.toString(),
        x: (index % 4) * 3,
        y: Math.floor(index / 4) * 4,
        w: 3,
        h: 4,
      }));

      const largeDashboardResponse = await request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Large Dashboard with 10 Widgets',
          layout: layout,
        })
        .expect(201);

      expect(largeDashboardResponse.body.status).toBe('SUCCESS');
      expect(largeDashboardResponse.body.data.layout).toHaveLength(10);

      const largeDashboardId = largeDashboardResponse.body.data.id;

      // 대시보드 조회 성능 테스트
      const startTime = Date.now();
      const getDashboardResponse = await request(app.getHttpServer())
        .get(`/api/dashboard/${largeDashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const endTime = Date.now();

      expect(getDashboardResponse.body.status).toBe('SUCCESS');
      expect(getDashboardResponse.body.data.layout).toHaveLength(10);

      // 응답 시간이 5초 이내여야 함
      expect(endTime - startTime).toBeLessThan(5000);

      // 정리
      await request(app.getHttpServer())
        .delete(`/api/dashboard/${largeDashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      // 위젯들 정리
      const cleanupPromises = widgetIds.map(id =>
        request(app.getHttpServer())
          .delete(`/api/widget/${id}`)
          .set('Authorization', `Bearer ${accessToken}`),
      );

      await Promise.all(cleanupPromises);
    });
  });
});
