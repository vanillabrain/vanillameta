import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/user/entities/user.entity';
import { Widget } from '../src/widget/entities/widget.entity';
import { Component } from '../src/component/entities/component.entity';
import { Database } from '../src/database/entities/database.entity';
import { Dataset } from '../src/dataset/entities/dataset.entity';
import { Repository } from 'typeorm';
import { DatasetType } from '../src/common/enum/dataset-type.enum';
import { YesNo } from '../src/common/enum/yn.enum';

describe('Widget Creation Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let widgetRepository: Repository<Widget>;
  let componentRepository: Repository<Component>;
  let databaseRepository: Repository<Database>;
  let datasetRepository: Repository<Dataset>;

  const testUser = {
    userId: 'testuser',
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User',
  };

  let userRecord: User;
  let authToken: string;
  let testDatabase: Database;
  let testDataset: Dataset;
  let testComponent: Component;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    widgetRepository = moduleFixture.get<Repository<Widget>>(getRepositoryToken(Widget));
    componentRepository = moduleFixture.get<Repository<Component>>(getRepositoryToken(Component));
    databaseRepository = moduleFixture.get<Repository<Database>>(getRepositoryToken(Database));
    datasetRepository = moduleFixture.get<Repository<Dataset>>(getRepositoryToken(Dataset));

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

    // 테스트 데이터베이스 생성
    testDatabase = await databaseRepository.save({
      name: 'Test Database',
      engine: 'mysql2',
      connectionConfig: JSON.stringify({
        host: 'localhost',
        port: 3306,
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
      }),
    });

    // 테스트 데이터셋 생성
    testDataset = await datasetRepository.save({
      name: 'Test Dataset',
      dataQuery: 'SELECT * FROM users',
      databaseId: testDatabase.id,
      datasetType: DatasetType.DATASET,
    });

    // 테스트 컴포넌트 생성
    testComponent = await componentRepository.save({
      type: 'line-chart',
      title: 'Line Chart',
      description: 'Line chart component',
      icon: 'line-chart-icon',
    });
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await widgetRepository.delete({});
    await datasetRepository.delete({});
    await componentRepository.delete({});
    await databaseRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  beforeEach(async () => {
    // 각 테스트 전 위젯 데이터 정리
    await widgetRepository.delete({});
  });

  describe('Widget CRUD Operations', () => {
    const testWidget = {
      title: 'Test Chart Widget',
      description: 'Test chart widget description',
      databaseId: 1,
      componentId: 1,
      datasetType: DatasetType.DATASET,
      datasetId: 1,
      tableName: '',
      option: {
        type: 'line',
        title: { text: 'Sales Chart' },
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        series: [{ data: [120, 200, 150], type: 'line' }],
      },
      delYn: YesNo.NO,
    };

    describe('POST /api/widget', () => {
      beforeEach(() => {
        testWidget.databaseId = testDatabase.id;
        testWidget.componentId = testComponent.id;
        testWidget.datasetId = testDataset.id;
      });

      it('should create a dataset widget successfully', () => {
        return request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testWidget)
          .expect(201)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data).toEqual(
              expect.objectContaining({
                title: testWidget.title,
                description: testWidget.description,
                databaseId: testWidget.databaseId,
                componentId: testWidget.componentId,
                datasetType: testWidget.datasetType,
                datasetId: testWidget.datasetId,
                option: testWidget.option,
              })
            );
          });
      });

      it('should create a table widget successfully', () => {
        const tableWidget = {
          ...testWidget,
          title: 'Test Table Widget',
          datasetType: DatasetType.TABLE,
          tableName: 'users',
          option: {
            showPagination: true,
            pageSize: 20,
            columns: ['id', 'name', 'email'],
          },
        };

        return request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(tableWidget)
          .expect(201)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.datasetType).toBe(DatasetType.TABLE);
            expect(res.body.data.option).toEqual(tableWidget.option);
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .post('/api/widget')
          .send(testWidget)
          .expect(401);
      });

      it('should validate required fields', () => {
        return request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // title missing
            description: testWidget.description,
            databaseId: testWidget.databaseId,
          })
          .expect(400);
      });

      it('should reject table widget with empty table name', () => {
        const invalidTableWidget = {
          ...testWidget,
          datasetType: DatasetType.TABLE,
          tableName: '', // Empty table name
        };

        return request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidTableWidget)
          .expect(201) // 현재 구현에서는 201로 응답하지만 에러 상태
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
            expect(res.body.message).toContain('필수 입력사항::::선택한 테이블명');
          });
      });

      it('should handle complex chart options', () => {
        const complexWidget = {
          ...testWidget,
          title: 'Complex Chart Widget',
          option: {
            type: 'line',
            title: { text: 'Sales Performance', fontSize: 18 },
            legend: { show: true, position: 'top' },
            grid: { left: '10%', right: '10%', top: '15%', bottom: '10%' },
            xAxis: {
              type: 'category',
              data: ['Q1', 'Q2', 'Q3', 'Q4'],
              axisLabel: { rotate: 45 },
            },
            yAxis: {
              type: 'value',
              name: 'Sales ($)',
              nameLocation: 'middle',
              nameGap: 50,
            },
            series: [
              {
                name: 'Product A',
                data: [100, 150, 200, 180],
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
              },
              {
                name: 'Product B',
                data: [80, 120, 160, 140],
                type: 'line',
                smooth: true,
                symbol: 'triangle',
                symbolSize: 6,
              },
            ],
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'cross' },
            },
            dataZoom: [
              { type: 'inside' },
              { type: 'slider' },
            ],
          },
        };

        return request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(complexWidget)
          .expect(201)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.option).toEqual(complexWidget.option);
          });
      });
    });

    describe('GET /api/widget', () => {
      beforeEach(async () => {
        testWidget.databaseId = testDatabase.id;
        testWidget.componentId = testComponent.id;
        testWidget.datasetId = testDataset.id;

        // 테스트용 위젯 생성
        await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testWidget);
      });

      it('should get all widgets with component information', () => {
        return request(app.getHttpServer())
          .get('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0]).toEqual(
              expect.objectContaining({
                title: testWidget.title,
                option: testWidget.option,
                componentType: testComponent.type,
                componentTitle: testComponent.title,
                icon: testComponent.icon,
              })
            );
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get('/api/widget')
          .expect(401);
      });

      it('should return empty array when no widgets exist', async () => {
        // 기존 위젯 삭제
        await widgetRepository.delete({});

        return request(app.getHttpServer())
          .get('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data).toEqual([]);
          });
      });
    });

    describe('GET /api/widget/:id', () => {
      let widgetId: number;

      beforeEach(async () => {
        testWidget.databaseId = testDatabase.id;
        testWidget.componentId = testComponent.id;
        testWidget.datasetId = testDataset.id;

        // 테스트용 위젯 생성
        const createResponse = await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testWidget);

        widgetId = createResponse.body.data.id;
      });

      it('should get specific widget by id', () => {
        return request(app.getHttpServer())
          .get(`/api/widget/${widgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data).toEqual(
              expect.objectContaining({
                id: widgetId,
                title: testWidget.title,
                option: testWidget.option,
                componentType: testComponent.type,
                componentTitle: testComponent.title,
              })
            );
          });
      });

      it('should return error for non-existent widget', () => {
        return request(app.getHttpServer())
          .get('/api/widget/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200) // 현재 구현에서는 200으로 에러 응답
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
            expect(res.body.message).toContain('위젯이 존재하지 않습니다');
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get(`/api/widget/${widgetId}`)
          .expect(401);
      });
    });

    describe('PUT /api/widget/:id', () => {
      let widgetId: number;

      beforeEach(async () => {
        testWidget.databaseId = testDatabase.id;
        testWidget.componentId = testComponent.id;
        testWidget.datasetId = testDataset.id;

        // 테스트용 위젯 생성
        const createResponse = await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testWidget);

        widgetId = createResponse.body.data.id;
      });

      it('should update widget title', () => {
        const updatedTitle = 'Updated Widget Title';

        return request(app.getHttpServer())
          .put(`/api/widget/${widgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: updatedTitle,
            option: testWidget.option,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.title).toBe(updatedTitle);
          });
      });

      it('should update widget options', () => {
        const updatedOption = {
          type: 'bar',
          title: { text: 'Updated Chart' },
          xAxis: { type: 'value' },
          yAxis: { type: 'category' },
          series: [{ data: [50, 100, 75], type: 'bar' }],
        };

        return request(app.getHttpServer())
          .put(`/api/widget/${widgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            option: updatedOption,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.option).toEqual(updatedOption);
          });
      });

      it('should update widget component', () => {
        return request(app.getHttpServer())
          .put(`/api/widget/${widgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            componentId: testComponent.id,
            option: testWidget.option,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.componentId).toBe(testComponent.id);
          });
      });

      it('should update widget deletion status', () => {
        return request(app.getHttpServer())
          .put(`/api/widget/${widgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            delYn: YesNo.YES,
            option: testWidget.option,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.delYn).toBe(YesNo.YES);
          });
      });

      it('should return error for non-existent widget', () => {
        return request(app.getHttpServer())
          .put('/api/widget/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Updated Title',
            option: testWidget.option,
          })
          .expect(200) // 현재 구현에서는 200으로 에러 응답
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
            expect(res.body.message).toContain('위젯이 존재하지 않습니다');
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .put(`/api/widget/${widgetId}`)
          .send({
            title: 'Updated Title',
            option: testWidget.option,
          })
          .expect(401);
      });
    });

    describe('DELETE /api/widget/:id', () => {
      let datasetWidgetId: number;
      let tableWidgetId: number;

      beforeEach(async () => {
        testWidget.databaseId = testDatabase.id;
        testWidget.componentId = testComponent.id;
        testWidget.datasetId = testDataset.id;

        // 데이터셋 위젯 생성
        const datasetResponse = await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testWidget);

        datasetWidgetId = datasetResponse.body.data.id;

        // 테이블 위젯 생성
        const tableWidget = {
          ...testWidget,
          title: 'Test Table Widget',
          datasetType: DatasetType.TABLE,
          tableName: 'users',
          option: { showPagination: true },
        };

        const tableResponse = await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send(tableWidget);

        tableWidgetId = tableResponse.body.data.id;
      });

      it('should delete dataset widget successfully', () => {
        return request(app.getHttpServer())
          .delete(`/api/widget/${datasetWidgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.message).toContain(`#${datasetWidgetId} widget`);
          });
      });

      it('should delete table widget successfully', () => {
        return request(app.getHttpServer())
          .delete(`/api/widget/${tableWidgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.message).toContain(`#${tableWidgetId} widget`);
          });
      });

      it('should return error for non-existent widget', () => {
        return request(app.getHttpServer())
          .delete('/api/widget/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200) // 현재 구현에서는 200으로 에러 응답
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
            expect(res.body.message).toBe('No exist');
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .delete(`/api/widget/${datasetWidgetId}`)
          .expect(401);
      });

      it('should verify widget is actually deleted', async () => {
        // 위젯 삭제
        await request(app.getHttpServer())
          .delete(`/api/widget/${datasetWidgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // 삭제된 위젯 조회 시도
        return request(app.getHttpServer())
          .get(`/api/widget/${datasetWidgetId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
          });
      });
    });
  });

  describe('Widget Data Visualization Flow', () => {
    it('should complete full widget creation and visualization flow', async () => {
      // 1. Create database connection
      const databaseResponse = await request(app.getHttpServer())
        .post('/api/database')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Visualization Test DB',
          engine: 'mysql2',
          connectionConfig: {
            host: 'localhost',
            port: 3306,
            user: 'testuser',
            password: 'testpass',
            database: 'testdb',
          },
        })
        .expect(201);

      const databaseId = databaseResponse.body.data.id;

      // 2. Create dataset
      const datasetResponse = await request(app.getHttpServer())
        .post('/api/dataset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Sales Data',
          dataQuery: 'SELECT month, sales FROM monthly_sales',
          databaseId: databaseId,
          datasetType: DatasetType.DATASET,
        })
        .expect(201);

      const datasetId = datasetResponse.body.data.id;

      // 3. Get available components
      const componentsResponse = await request(app.getHttpServer())
        .get('/api/component')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const lineChartComponent = componentsResponse.body.data.find(c => c.type === 'line-chart');

      // 4. Create widget
      const widgetResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Monthly Sales Chart',
          description: 'Chart showing monthly sales data',
          databaseId: databaseId,
          componentId: lineChartComponent.id,
          datasetType: DatasetType.DATASET,
          datasetId: datasetId,
          tableName: '',
          option: {
            type: 'line',
            title: { text: 'Monthly Sales' },
            xAxis: { type: 'category', name: 'Month' },
            yAxis: { type: 'value', name: 'Sales' },
            series: [{ type: 'line', name: 'Sales' }],
          },
          delYn: YesNo.NO,
        })
        .expect(201);

      const widgetId = widgetResponse.body.data.id;

      // 5. Verify widget creation
      expect(widgetResponse.body.status).toBe('SUCCESS');
      expect(widgetResponse.body.data.title).toBe('Monthly Sales Chart');

      // 6. Get widget details
      const widgetDetailResponse = await request(app.getHttpServer())
        .get(`/api/widget/${widgetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(widgetDetailResponse.body.data.option.title.text).toBe('Monthly Sales');

      // 7. Update widget configuration
      const updatedOption = {
        type: 'bar',
        title: { text: 'Monthly Sales (Bar Chart)' },
        xAxis: { type: 'category', name: 'Month' },
        yAxis: { type: 'value', name: 'Sales' },
        series: [{ type: 'bar', name: 'Sales', color: '#1890ff' }],
      };

      await request(app.getHttpServer())
        .put(`/api/widget/${widgetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          option: updatedOption,
        })
        .expect(200);

      // 8. Verify widget list includes the created widget
      const widgetListResponse = await request(app.getHttpServer())
        .get('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const createdWidget = widgetListResponse.body.data.find(w => w.id === widgetId);
      expect(createdWidget).toBeDefined();
      expect(createdWidget.option.type).toBe('bar');
    });

    it('should handle table widget creation flow', async () => {
      // 1. Create table widget
      const tableWidgetResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'User Data Table',
          description: 'Table showing user information',
          databaseId: testDatabase.id,
          componentId: testComponent.id,
          datasetType: DatasetType.TABLE,
          datasetId: 1, // Will be updated by service
          tableName: 'users',
          option: {
            showPagination: true,
            pageSize: 50,
            columns: ['id', 'name', 'email', 'created_at'],
            sortable: true,
            filterable: true,
          },
          delYn: YesNo.NO,
        })
        .expect(201);

      const tableWidgetId = tableWidgetResponse.body.data.id;

      // 2. Verify table widget creation
      expect(tableWidgetResponse.body.status).toBe('SUCCESS');
      expect(tableWidgetResponse.body.data.datasetType).toBe(DatasetType.TABLE);

      // 3. Update table widget configuration
      const updatedTableOption = {
        showPagination: true,
        pageSize: 25,
        columns: ['id', 'name', 'email'],
        sortable: true,
        filterable: false,
        striped: true,
      };

      await request(app.getHttpServer())
        .put(`/api/widget/${tableWidgetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          option: updatedTableOption,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.option).toEqual(updatedTableOption);
        });

      // 4. Delete table widget (should clean up table query)
      await request(app.getHttpServer())
        .delete(`/api/widget/${tableWidgetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Complex Widget Scenarios', () => {
    it('should handle multiple chart types in sequence', async () => {
      const chartTypes = [
        {
          type: 'line',
          title: 'Line Chart Widget',
          option: {
            type: 'line',
            series: [{ type: 'line', data: [1, 2, 3] }],
          },
        },
        {
          type: 'bar',
          title: 'Bar Chart Widget',
          option: {
            type: 'bar',
            series: [{ type: 'bar', data: [3, 2, 1] }],
          },
        },
        {
          type: 'pie',
          title: 'Pie Chart Widget',
          option: {
            type: 'pie',
            series: [{ type: 'pie', data: [{ name: 'A', value: 50 }, { name: 'B', value: 30 }] }],
          },
        },
      ];

      const createdWidgets = [];

      for (const chartConfig of chartTypes) {
        const response = await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: chartConfig.title,
            description: `${chartConfig.type} chart widget`,
            databaseId: testDatabase.id,
            componentId: testComponent.id,
            datasetType: DatasetType.DATASET,
            datasetId: testDataset.id,
            tableName: '',
            option: chartConfig.option,
            delYn: YesNo.NO,
          })
          .expect(201);

        createdWidgets.push(response.body.data);
      }

      // Verify all widgets were created
      expect(createdWidgets).toHaveLength(3);
      createdWidgets.forEach((widget, index) => {
        expect(widget.title).toBe(chartTypes[index].title);
        expect(widget.option.type).toBe(chartTypes[index].type);
      });

      // Verify widgets appear in list
      const listResponse = await request(app.getHttpServer())
        .get('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle concurrent widget operations', async () => {
      // 동시에 여러 위젯 생성
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Concurrent Widget ${i + 1}`,
            description: `Concurrent widget ${i + 1}`,
            databaseId: testDatabase.id,
            componentId: testComponent.id,
            datasetType: DatasetType.DATASET,
            datasetId: testDataset.id,
            tableName: '',
            option: {
              type: 'line',
              series: [{ data: [i * 10, i * 20, i * 30], type: 'line' }],
            },
            delYn: YesNo.NO,
          })
      );

      const responses = await Promise.all(createPromises);

      // 모든 위젯이 성공적으로 생성되었는지 확인
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('SUCCESS');
        expect(response.body.data.title).toBe(`Concurrent Widget ${index + 1}`);
      });

      // 생성된 위젯들이 목록에 나타나는지 확인
      const listResponse = await request(app.getHttpServer())
        .get('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle large option configurations', async () => {
      // 매우 복잡한 차트 옵션 생성
      const largeOption = {
        type: 'line',
        title: {
          text: 'Complex Multi-Series Chart',
          fontSize: 18,
          fontWeight: 'bold',
        },
        legend: {
          show: true,
          position: 'top',
          data: Array.from({ length: 10 }, (_, i) => `Series ${i + 1}`),
        },
        grid: {
          left: '10%',
          right: '10%',
          top: '20%',
          bottom: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: Array.from({ length: 100 }, (_, i) => `Item ${i + 1}`),
          axisLabel: { rotate: 45, fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          name: 'Values',
          nameLocation: 'middle',
          nameGap: 50,
          splitLine: { show: true },
        },
        series: Array.from({ length: 10 }, (_, i) => ({
          name: `Series ${i + 1}`,
          type: 'line',
          data: Array.from({ length: 100 }, () => Math.random() * 1000),
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
        })),
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          formatter: '{b}: {c}',
        },
        dataZoom: [
          { type: 'inside', start: 0, end: 50 },
          { type: 'slider', start: 0, end: 50 },
        ],
        toolbox: {
          feature: {
            saveAsImage: {},
            dataZoom: { yAxisIndex: 'none' },
            restore: {},
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Large Configuration Widget',
          description: 'Widget with very large configuration',
          databaseId: testDatabase.id,
          componentId: testComponent.id,
          datasetType: DatasetType.DATASET,
          datasetId: testDataset.id,
          tableName: '',
          option: largeOption,
          delYn: YesNo.NO,
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.data.option).toEqual(largeOption);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid component ID', () => {
      return request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Component Widget',
          description: 'Widget with invalid component',
          databaseId: testDatabase.id,
          componentId: 999999,
          datasetType: DatasetType.DATASET,
          datasetId: testDataset.id,
          tableName: '',
          option: { type: 'line' },
          delYn: YesNo.NO,
        })
        .expect(400); // Should fail validation
    });

    it('should handle invalid database ID', () => {
      return request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Database Widget',
          description: 'Widget with invalid database',
          databaseId: 999999,
          componentId: testComponent.id,
          datasetType: DatasetType.DATASET,
          datasetId: testDataset.id,
          tableName: '',
          option: { type: 'line' },
          delYn: YesNo.NO,
        })
        .expect(400); // Should fail validation
    });

    it('should handle special characters in widget title', () => {
      const specialTitle = 'Widget with 특수문자 & symbols! @#$%^&*()';

      return request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: specialTitle,
          description: 'Special character test',
          databaseId: testDatabase.id,
          componentId: testComponent.id,
          datasetType: DatasetType.DATASET,
          datasetId: testDataset.id,
          tableName: '',
          option: { type: 'line' },
          delYn: YesNo.NO,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.title).toBe(specialTitle);
        });
    });

    it('should handle very long widget title', () => {
      const longTitle = 'A'.repeat(1000);

      return request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: longTitle,
          description: 'Long title test',
          databaseId: testDatabase.id,
          componentId: testComponent.id,
          datasetType: DatasetType.DATASET,
          datasetId: testDataset.id,
          tableName: '',
          option: { type: 'line' },
          delYn: YesNo.NO,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.title).toBe(longTitle);
        });
    });

    it('should handle null option values', () => {
      return request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Null Option Widget',
          description: 'Widget with null option',
          databaseId: testDatabase.id,
          componentId: testComponent.id,
          datasetType: DatasetType.DATASET,
          datasetId: testDataset.id,
          tableName: '',
          option: null,
          delYn: YesNo.NO,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.option).toBeNull();
        });
    });
  });
});