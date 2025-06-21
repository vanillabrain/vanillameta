import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { Template } from '../src/template/entities/template.entity';
import { Dashboard } from '../src/dashboard/entities/dashboard.entity';
import { Widget } from '../src/widget/entities/widget.entity';
import { Dataset } from '../src/dataset/entities/dataset.entity';
import { Database } from '../src/database/entities/database.entity';
import { TemplateType } from '../src/common/enum/template-type.enum';

describe('Template Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let templateRepository: Repository<Template>;
  let dashboardRepository: Repository<Dashboard>;
  let widgetRepository: Repository<Widget>;
  let datasetRepository: Repository<Dataset>;
  let databaseRepository: Repository<Database>;

  const testUser = {
    userId: 'templateuser',
    email: 'templateuser@example.com',
    password: 'templatepassword123',
    name: 'Template Test User',
  };

  const adminUser = {
    userId: 'adminuser',
    email: 'admin@example.com',
    password: 'adminpassword123',
    name: 'Admin User',
    isAdmin: true,
  };

  let userAccessToken: string;
  let adminAccessToken: string;
  let userId: number;
  let adminId: number;
  let testDashboardId: number;
  let testDatabaseId: number;
  let testDatasetId: number;
  let testWidgetId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    templateRepository = moduleFixture.get<Repository<Template>>(getRepositoryToken(Template));
    dashboardRepository = moduleFixture.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    widgetRepository = moduleFixture.get<Repository<Widget>>(getRepositoryToken(Widget));
    datasetRepository = moduleFixture.get<Repository<Dataset>>(getRepositoryToken(Dataset));
    databaseRepository = moduleFixture.get<Repository<Database>>(getRepositoryToken(Database));

    // 테스트 사용자 생성 및 로그인
    const savedUser = await userRepository.save(testUser);
    userId = savedUser.id;

    const savedAdmin = await userRepository.save(adminUser);
    adminId = savedAdmin.id;

    // 일반 사용자 로그인
    const userLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    userAccessToken = userLoginResponse.body.accessToken;

    // 관리자 로그인
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: adminUser.userId,
        password: adminUser.password,
      })
      .expect(201);

    adminAccessToken = adminLoginResponse.body.accessToken;

    // 테스트 데이터 준비
    // 1. 데이터베이스 생성
    const database = await databaseRepository.save({
      name: 'Template Test DB',
      engine: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
      userId: userId,
    });
    testDatabaseId = database.id;

    // 2. 데이터셋 생성
    const dataset = await datasetRepository.save({
      title: 'Template Test Dataset',
      databaseId: testDatabaseId,
      query: 'SELECT category, value FROM sales',
      userId: userId,
    });
    testDatasetId = dataset.id;

    // 3. 대시보드 생성
    const dashboard = await dashboardRepository.save({
      title: 'Template Source Dashboard',
      description: 'Dashboard to create template from',
      layout: [
        { i: 'widget-1', x: 0, y: 0, w: 6, h: 4 },
        { i: 'widget-2', x: 6, y: 0, w: 6, h: 4 },
      ],
      userId: userId,
    });
    testDashboardId = dashboard.id;

    // 4. 위젯들 생성
    const widget1 = await widgetRepository.save({
      name: 'Sales by Category',
      dashboardId: testDashboardId,
      datasetType: 'DATASET',
      datasetId: testDatasetId,
      componentType: 'pieChart',
      chartOptions: { 
        type: 'pie',
        title: { text: 'Sales Distribution' },
      },
      size: { x: 0, y: 0, w: 6, h: 4 },
      userId: userId,
    });

    const widget2 = await widgetRepository.save({
      name: 'Monthly Trend',
      dashboardId: testDashboardId,
      datasetType: 'DATASET',
      datasetId: testDatasetId,
      componentType: 'lineChart',
      chartOptions: { 
        type: 'line',
        title: { text: 'Monthly Sales Trend' },
      },
      size: { x: 6, y: 0, w: 6, h: 4 },
      userId: userId,
    });

    testWidgetId = widget1.id;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await templateRepository.delete({});
    await widgetRepository.delete({});
    await dashboardRepository.delete({});
    await datasetRepository.delete({});
    await databaseRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('Template Creation', () => {
    it('should create template from dashboard', async () => {
      const createTemplateResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Sales Dashboard Template',
          description: 'Template for sales analytics dashboards',
          dashboardId: testDashboardId,
          templateType: TemplateType.USER,
          category: 'Analytics',
          tags: ['sales', 'analytics', 'business'],
        })
        .expect(201);

      expect(createTemplateResponse.body.status).toBe('SUCCESS');
      expect(createTemplateResponse.body.data).toHaveProperty('id');
      expect(createTemplateResponse.body.data.title).toBe('Sales Dashboard Template');
      expect(createTemplateResponse.body.data.templateType).toBe(TemplateType.USER);
      expect(createTemplateResponse.body.data.config).toHaveProperty('layout');
      expect(createTemplateResponse.body.data.config).toHaveProperty('widgets');
      expect(createTemplateResponse.body.data.config.widgets).toHaveLength(2);
    });

    it('should create system template as admin', async () => {
      const createSystemTemplateResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          title: 'Official Analytics Template',
          description: 'System-provided analytics template',
          dashboardId: testDashboardId,
          templateType: TemplateType.SYSTEM,
          category: 'Official',
          tags: ['official', 'analytics', 'recommended'],
          isPublic: true,
        })
        .expect(201);

      expect(createSystemTemplateResponse.body.status).toBe('SUCCESS');
      expect(createSystemTemplateResponse.body.data.templateType).toBe(TemplateType.SYSTEM);
      expect(createSystemTemplateResponse.body.data.isPublic).toBe(true);
    });

    it('should reject system template creation by non-admin', async () => {
      const unauthorizedResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Unauthorized System Template',
          description: 'Should fail',
          dashboardId: testDashboardId,
          templateType: TemplateType.SYSTEM,
          category: 'Official',
        })
        .expect(403);

      expect(unauthorizedResponse.body.status).toBe('ERROR');
    });

    it('should create template with preview image', async () => {
      const createWithPreviewResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Template with Preview',
          description: 'Template including preview image',
          dashboardId: testDashboardId,
          templateType: TemplateType.USER,
          category: 'Visual',
          previewImageUrl: 'https://example.com/preview.png',
        })
        .expect(201);

      expect(createWithPreviewResponse.body.status).toBe('SUCCESS');
      expect(createWithPreviewResponse.body.data.previewImageUrl).toBe('https://example.com/preview.png');
    });
  });

  describe('Template Listing and Search', () => {
    beforeEach(async () => {
      // 검색 테스트를 위한 다양한 템플릿 생성
      const templates = [
        {
          title: 'Financial Dashboard',
          description: 'Financial metrics and KPIs',
          category: 'Finance',
          tags: ['finance', 'kpi', 'metrics'],
          templateType: TemplateType.USER,
          isPublic: true,
        },
        {
          title: 'Marketing Analytics',
          description: 'Marketing campaign performance',
          category: 'Marketing',
          tags: ['marketing', 'campaign', 'analytics'],
          templateType: TemplateType.USER,
          isPublic: false,
        },
        {
          title: 'HR Dashboard',
          description: 'Human resources metrics',
          category: 'HR',
          tags: ['hr', 'employee', 'metrics'],
          templateType: TemplateType.SYSTEM,
          isPublic: true,
        },
      ];

      for (const template of templates) {
        await templateRepository.save({
          ...template,
          dashboardId: testDashboardId,
          config: {
            layout: [],
            widgets: [],
          },
          userId: template.templateType === TemplateType.SYSTEM ? adminId : userId,
        });
      }
    });

    it('should list all public templates', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(listResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(listResponse.body.data)).toBe(true);
      
      const publicTemplates = listResponse.body.data.filter(t => t.isPublic);
      expect(publicTemplates.length).toBeGreaterThan(0);
    });

    it('should list user templates', async () => {
      const userTemplatesResponse = await request(app.getHttpServer())
        .get('/api/template/my-templates')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(userTemplatesResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(userTemplatesResponse.body.data)).toBe(true);
      
      const userTemplates = userTemplatesResponse.body.data.filter(t => t.userId === userId);
      expect(userTemplates.length).toBeGreaterThan(0);
    });

    it('should filter templates by category', async () => {
      const categoryResponse = await request(app.getHttpServer())
        .get('/api/template?category=Finance')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(categoryResponse.body.status).toBe('SUCCESS');
      const financeTemplates = categoryResponse.body.data.filter(t => t.category === 'Finance');
      expect(financeTemplates.length).toBeGreaterThan(0);
    });

    it('should search templates by keyword', async () => {
      const searchResponse = await request(app.getHttpServer())
        .get('/api/template?search=marketing')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(searchResponse.body.status).toBe('SUCCESS');
      const marketingTemplates = searchResponse.body.data.filter(t => 
        t.title.toLowerCase().includes('marketing') || 
        t.description.toLowerCase().includes('marketing')
      );
      expect(marketingTemplates.length).toBeGreaterThan(0);
    });

    it('should filter templates by tags', async () => {
      const tagResponse = await request(app.getHttpServer())
        .get('/api/template?tags=analytics,metrics')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(tagResponse.body.status).toBe('SUCCESS');
      expect(tagResponse.body.data.length).toBeGreaterThan(0);
    });

    it('should paginate template results', async () => {
      const paginatedResponse = await request(app.getHttpServer())
        .get('/api/template?page=1&limit=2')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(paginatedResponse.body.status).toBe('SUCCESS');
      expect(paginatedResponse.body.data).toHaveProperty('items');
      expect(paginatedResponse.body.data).toHaveProperty('total');
      expect(paginatedResponse.body.data).toHaveProperty('page');
      expect(paginatedResponse.body.data).toHaveProperty('limit');
      expect(paginatedResponse.body.data.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Template Usage', () => {
    let templateId: number;

    beforeEach(async () => {
      // 사용할 템플릿 생성
      const createResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Reusable Template',
          description: 'Template for creating new dashboards',
          dashboardId: testDashboardId,
          templateType: TemplateType.USER,
          category: 'General',
        })
        .expect(201);

      templateId = createResponse.body.data.id;
    });

    it('should create dashboard from template', async () => {
      const createFromTemplateResponse = await request(app.getHttpServer())
        .post(`/api/template/${templateId}/apply`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          dashboardTitle: 'New Dashboard from Template',
          dashboardDescription: 'Created using template',
        })
        .expect(201);

      expect(createFromTemplateResponse.body.status).toBe('SUCCESS');
      expect(createFromTemplateResponse.body.data).toHaveProperty('dashboardId');
      expect(createFromTemplateResponse.body.data).toHaveProperty('widgetIds');
      expect(createFromTemplateResponse.body.data.widgetIds).toHaveLength(2);

      // 생성된 대시보드 확인
      const newDashboardId = createFromTemplateResponse.body.data.dashboardId;
      const dashboardResponse = await request(app.getHttpServer())
        .get(`/api/dashboard/${newDashboardId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(dashboardResponse.body.data.title).toBe('New Dashboard from Template');
      expect(dashboardResponse.body.data.layout).toHaveLength(2);
    });

    it('should track template usage count', async () => {
      // 템플릿 사용 전 정보 조회
      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/template/${templateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      const beforeUsageCount = beforeResponse.body.data.usageCount || 0;

      // 템플릿 사용
      await request(app.getHttpServer())
        .post(`/api/template/${templateId}/apply`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          dashboardTitle: 'Another Dashboard',
          dashboardDescription: 'Testing usage count',
        })
        .expect(201);

      // 템플릿 사용 후 정보 조회
      const afterResponse = await request(app.getHttpServer())
        .get(`/api/template/${templateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(afterResponse.body.data.usageCount).toBe(beforeUsageCount + 1);
    });

    it('should preview template before applying', async () => {
      const previewResponse = await request(app.getHttpServer())
        .get(`/api/template/${templateId}/preview`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(previewResponse.body.status).toBe('SUCCESS');
      expect(previewResponse.body.data).toHaveProperty('layout');
      expect(previewResponse.body.data).toHaveProperty('widgets');
      expect(previewResponse.body.data).toHaveProperty('requiredDatasets');
    });
  });

  describe('Template Management', () => {
    let managedTemplateId: number;

    beforeEach(async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Template to Manage',
          description: 'Original description',
          dashboardId: testDashboardId,
          templateType: TemplateType.USER,
          category: 'Test',
          isPublic: false,
        })
        .expect(201);

      managedTemplateId = createResponse.body.data.id;
    });

    it('should update template metadata', async () => {
      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/template/${managedTemplateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Updated Template Title',
          description: 'Updated description with more details',
          category: 'Updated',
          tags: ['updated', 'modified'],
          isPublic: true,
        })
        .expect(200);

      expect(updateResponse.body.status).toBe('SUCCESS');
      expect(updateResponse.body.data.title).toBe('Updated Template Title');
      expect(updateResponse.body.data.isPublic).toBe(true);
    });

    it('should update template configuration', async () => {
      const newConfig = {
        layout: [
          { i: 'widget-1', x: 0, y: 0, w: 12, h: 6 },
        ],
        widgets: [
          {
            name: 'Updated Widget',
            componentType: 'barChart',
            chartOptions: { type: 'bar' },
          },
        ],
      };

      const updateConfigResponse = await request(app.getHttpServer())
        .patch(`/api/template/${managedTemplateId}/config`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          config: newConfig,
        })
        .expect(200);

      expect(updateConfigResponse.body.status).toBe('SUCCESS');
      expect(updateConfigResponse.body.data.config).toEqual(newConfig);
    });

    it('should not allow other users to update template', async () => {
      // 다른 사용자 생성
      const otherUser = await userRepository.save({
        userId: 'otheruser',
        email: 'other@example.com',
        password: 'otherpass123',
        name: 'Other User',
      });

      const otherLoginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: 'otheruser',
          password: 'otherpass123',
        })
        .expect(201);

      const otherAccessToken = otherLoginResponse.body.accessToken;

      // 다른 사용자가 업데이트 시도
      const unauthorizedUpdateResponse = await request(app.getHttpServer())
        .patch(`/api/template/${managedTemplateId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({
          title: 'Unauthorized Update',
        })
        .expect(403);

      expect(unauthorizedUpdateResponse.body.status).toBe('ERROR');

      // 정리
      await userRepository.delete({ id: otherUser.id });
    });

    it('should delete template', async () => {
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/template/${managedTemplateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(deleteResponse.body.status).toBe('SUCCESS');

      // 삭제 확인
      const getDeletedResponse = await request(app.getHttpServer())
        .get(`/api/template/${managedTemplateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(404);

      expect(getDeletedResponse.body.status).toBe('ERROR');
    });
  });

  describe('Template Categories and Tags', () => {
    it('should get all available categories', async () => {
      const categoriesResponse = await request(app.getHttpServer())
        .get('/api/template/categories')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(categoriesResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(categoriesResponse.body.data)).toBe(true);
      expect(categoriesResponse.body.data).toContain('Analytics');
      expect(categoriesResponse.body.data).toContain('Finance');
    });

    it('should get popular tags', async () => {
      const tagsResponse = await request(app.getHttpServer())
        .get('/api/template/tags/popular')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(tagsResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(tagsResponse.body.data)).toBe(true);
      
      if (tagsResponse.body.data.length > 0) {
        expect(tagsResponse.body.data[0]).toHaveProperty('tag');
        expect(tagsResponse.body.data[0]).toHaveProperty('count');
      }
    });
  });

  describe('Template Recommendations', () => {
    it('should get recommended templates', async () => {
      const recommendationsResponse = await request(app.getHttpServer())
        .get('/api/template/recommendations')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(recommendationsResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(recommendationsResponse.body.data)).toBe(true);
    });

    it('should get trending templates', async () => {
      const trendingResponse = await request(app.getHttpServer())
        .get('/api/template/trending')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(trendingResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(trendingResponse.body.data)).toBe(true);
    });
  });

  describe('Template Import/Export', () => {
    let exportTemplateId: number;

    beforeEach(async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Export Test Template',
          description: 'Template for export testing',
          dashboardId: testDashboardId,
          templateType: TemplateType.USER,
          category: 'Export',
        })
        .expect(201);

      exportTemplateId = createResponse.body.data.id;
    });

    it('should export template as JSON', async () => {
      const exportResponse = await request(app.getHttpServer())
        .get(`/api/template/${exportTemplateId}/export`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(exportResponse.body.status).toBe('SUCCESS');
      expect(exportResponse.body.data).toHaveProperty('template');
      expect(exportResponse.body.data.template).toHaveProperty('title');
      expect(exportResponse.body.data.template).toHaveProperty('config');
      expect(exportResponse.body.data).toHaveProperty('version');
      expect(exportResponse.body.data).toHaveProperty('exportedAt');
    });

    it('should import template from JSON', async () => {
      // 먼저 템플릿을 내보내기
      const exportResponse = await request(app.getHttpServer())
        .get(`/api/template/${exportTemplateId}/export`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      const exportedData = exportResponse.body.data;

      // 내보낸 템플릿을 수정하여 가져오기
      exportedData.template.title = 'Imported Template';
      exportedData.template.description = 'Template imported from JSON';

      const importResponse = await request(app.getHttpServer())
        .post('/api/template/import')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          templateData: exportedData,
        })
        .expect(201);

      expect(importResponse.body.status).toBe('SUCCESS');
      expect(importResponse.body.data.title).toBe('Imported Template');
    });

    it('should validate imported template format', async () => {
      const invalidImportResponse = await request(app.getHttpServer())
        .post('/api/template/import')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          templateData: {
            // 잘못된 형식
            invalidField: 'invalid',
          },
        })
        .expect(400);

      expect(invalidImportResponse.body.status).toBe('ERROR');
      expect(invalidImportResponse.body.message).toContain('Invalid template format');
    });
  });

  describe('Template Versioning', () => {
    let versionedTemplateId: number;

    beforeEach(async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/template')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Versioned Template',
          description: 'Template with version history',
          dashboardId: testDashboardId,
          templateType: TemplateType.USER,
          category: 'Versioned',
        })
        .expect(201);

      versionedTemplateId = createResponse.body.data.id;
    });

    it('should create new version when updating template', async () => {
      // 첫 번째 업데이트
      await request(app.getHttpServer())
        .patch(`/api/template/${versionedTemplateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Versioned Template v2',
          description: 'Updated version',
        })
        .expect(200);

      // 버전 히스토리 조회
      const historyResponse = await request(app.getHttpServer())
        .get(`/api/template/${versionedTemplateId}/versions`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(historyResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(historyResponse.body.data)).toBe(true);
      expect(historyResponse.body.data.length).toBeGreaterThan(1);
    });

    it('should restore previous version', async () => {
      // 여러 버전 생성
      await request(app.getHttpServer())
        .patch(`/api/template/${versionedTemplateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Version 2',
        })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/template/${versionedTemplateId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Version 3',
        })
        .expect(200);

      // 버전 목록 가져오기
      const versionsResponse = await request(app.getHttpServer())
        .get(`/api/template/${versionedTemplateId}/versions`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      const versions = versionsResponse.body.data;
      const previousVersionId = versions[1].id; // 두 번째 버전

      // 이전 버전으로 복원
      const restoreResponse = await request(app.getHttpServer())
        .post(`/api/template/${versionedTemplateId}/restore/${previousVersionId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(restoreResponse.body.status).toBe('SUCCESS');
      expect(restoreResponse.body.data.title).toBe('Version 2');
    });
  });
});