import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { Dashboard } from '../src/dashboard/entities/dashboard.entity';
import { ShareUrl } from '../src/share-url/entities/share-url.entity';
import { Widget } from '../src/widget/entities/widget.entity';
import { Dataset } from '../src/dataset/entities/dataset.entity';
import { Database } from '../src/database/entities/database.entity';
import { ShareType } from '../src/common/enum/share-type.enum';

describe('Share URL Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let dashboardRepository: Repository<Dashboard>;
  let shareUrlRepository: Repository<ShareUrl>;
  let widgetRepository: Repository<Widget>;
  let datasetRepository: Repository<Dataset>;
  let databaseRepository: Repository<Database>;

  const testUser = {
    userId: 'shareuser',
    email: 'shareuser@example.com',
    password: 'sharepassword123',
    name: 'Share Test User',
  };

  let accessToken: string;
  let userId: number;
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
    dashboardRepository = moduleFixture.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    shareUrlRepository = moduleFixture.get<Repository<ShareUrl>>(getRepositoryToken(ShareUrl));
    widgetRepository = moduleFixture.get<Repository<Widget>>(getRepositoryToken(Widget));
    datasetRepository = moduleFixture.get<Repository<Dataset>>(getRepositoryToken(Dataset));
    databaseRepository = moduleFixture.get<Repository<Database>>(getRepositoryToken(Database));

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

    // 테스트 데이터 준비
    // 1. 데이터베이스 생성
    const database = await databaseRepository.save({
      name: 'Share Test DB',
      engine: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
      userId: userId,
    });
    testDatabaseId = database.id;

    // 2. 데이터셋 생성
    const dataset = await datasetRepository.save({
      title: 'Share Test Dataset',
      databaseId: testDatabaseId,
      query: 'SELECT 1 as test_column',
      userId: userId,
    });
    testDatasetId = dataset.id;

    // 3. 대시보드 생성
    const dashboard = await dashboardRepository.save({
      title: 'Share Test Dashboard',
      description: 'Dashboard for share URL testing',
      layout: [],
      userId: userId,
    });
    testDashboardId = dashboard.id;

    // 4. 위젯 생성
    const widget = await widgetRepository.save({
      name: 'Share Test Widget',
      dashboardId: testDashboardId,
      datasetType: 'DATASET',
      datasetId: testDatasetId,
      componentType: 'barChart',
      chartOptions: { type: 'bar' },
      size: { x: 0, y: 0, w: 4, h: 4 },
      userId: userId,
    });
    testWidgetId = widget.id;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await shareUrlRepository.delete({});
    await widgetRepository.delete({});
    await dashboardRepository.delete({});
    await datasetRepository.delete({});
    await databaseRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('Share URL Creation', () => {
    it('should create public share URL', async () => {
      const createShareResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PUBLIC,
          expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
        })
        .expect(201);

      expect(createShareResponse.body.status).toBe('SUCCESS');
      expect(createShareResponse.body.data).toHaveProperty('shareUrl');
      expect(createShareResponse.body.data).toHaveProperty('shareType');
      expect(createShareResponse.body.data.shareType).toBe(ShareType.PUBLIC);
      expect(createShareResponse.body.data.dashboardId).toBe(testDashboardId);
    });

    it('should create private share URL with password', async () => {
      const password = 'secretpass123';
      
      const createShareResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PRIVATE,
          password: password,
          expiredAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
        })
        .expect(201);

      expect(createShareResponse.body.status).toBe('SUCCESS');
      expect(createShareResponse.body.data.shareType).toBe(ShareType.PRIVATE);
      expect(createShareResponse.body.data).not.toHaveProperty('password'); // 비밀번호는 반환하지 않아야 함
    });

    it('should reject share URL creation without dashboard', async () => {
      const invalidResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: 99999, // 존재하지 않는 대시보드 ID
          shareType: ShareType.PUBLIC,
        })
        .expect(404);

      expect(invalidResponse.body.status).toBe('ERROR');
    });

    it('should reject share URL creation with invalid expiration', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 어제
      
      const invalidResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PUBLIC,
          expiredAt: pastDate,
        })
        .expect(400);

      expect(invalidResponse.body.status).toBe('ERROR');
    });
  });

  describe('Share URL Access', () => {
    let publicShareUrl: string;
    let privateShareUrl: string;
    const privatePassword = 'test123';

    beforeEach(async () => {
      // 공개 공유 URL 생성
      const publicShareResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PUBLIC,
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .expect(201);

      publicShareUrl = publicShareResponse.body.data.shareUrl;

      // 비공개 공유 URL 생성
      const privateShareResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PRIVATE,
          password: privatePassword,
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .expect(201);

      privateShareUrl = privateShareResponse.body.data.shareUrl;
    });

    it('should access public share URL without authentication', async () => {
      const accessResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${publicShareUrl}`)
        .expect(200);

      expect(accessResponse.body.status).toBe('SUCCESS');
      expect(accessResponse.body.data).toHaveProperty('dashboard');
      expect(accessResponse.body.data.dashboard.id).toBe(testDashboardId);
    });

    it('should access private share URL with correct password', async () => {
      const accessResponse = await request(app.getHttpServer())
        .post(`/api/share-url/${privateShareUrl}/verify`)
        .send({ password: privatePassword })
        .expect(200);

      expect(accessResponse.body.status).toBe('SUCCESS');
      expect(accessResponse.body.data).toHaveProperty('dashboard');
    });

    it('should reject private share URL with incorrect password', async () => {
      const accessResponse = await request(app.getHttpServer())
        .post(`/api/share-url/${privateShareUrl}/verify`)
        .send({ password: 'wrongpassword' })
        .expect(401);

      expect(accessResponse.body.status).toBe('ERROR');
    });

    it('should reject access to non-existent share URL', async () => {
      const nonExistentUrl = 'non-existent-share-url';
      
      const accessResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${nonExistentUrl}`)
        .expect(404);

      expect(accessResponse.body.status).toBe('ERROR');
    });

    it('should track share URL access count', async () => {
      // 첫 번째 접근
      await request(app.getHttpServer())
        .get(`/api/share-url/${publicShareUrl}`)
        .expect(200);

      // 두 번째 접근
      await request(app.getHttpServer())
        .get(`/api/share-url/${publicShareUrl}`)
        .expect(200);

      // 접근 횟수 확인
      const shareInfo = await shareUrlRepository.findOne({ 
        where: { shareUrl: publicShareUrl } 
      });
      
      expect(shareInfo.accessCount).toBeGreaterThan(0);
    });
  });

  describe('Share URL Management', () => {
    let shareUrlToManage: string;
    let shareId: number;

    beforeEach(async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PUBLIC,
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .expect(201);

      shareUrlToManage = createResponse.body.data.shareUrl;
      shareId = createResponse.body.data.id;
    });

    it('should list all share URLs for a dashboard', async () => {
      const listResponse = await request(app.getHttpServer())
        .get(`/api/share-url/dashboard/${testDashboardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(listResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(listResponse.body.data)).toBe(true);
      expect(listResponse.body.data.length).toBeGreaterThan(0);
      
      const foundShare = listResponse.body.data.find(s => s.shareUrl === shareUrlToManage);
      expect(foundShare).toBeDefined();
    });

    it('should update share URL expiration', async () => {
      const newExpiration = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14일 후
      
      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/share-url/${shareId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          expiredAt: newExpiration,
        })
        .expect(200);

      expect(updateResponse.body.status).toBe('SUCCESS');
      expect(new Date(updateResponse.body.data.expiredAt).getTime())
        .toBeCloseTo(newExpiration.getTime(), -3); // 밀리초 단위 오차 허용
    });

    it('should deactivate share URL', async () => {
      const deactivateResponse = await request(app.getHttpServer())
        .patch(`/api/share-url/${shareId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          isActive: false,
        })
        .expect(200);

      expect(deactivateResponse.body.status).toBe('SUCCESS');
      expect(deactivateResponse.body.data.isActive).toBe(false);

      // 비활성화된 URL 접근 시도
      const accessResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${shareUrlToManage}`)
        .expect(403);

      expect(accessResponse.body.status).toBe('ERROR');
    });

    it('should delete share URL', async () => {
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/share-url/${shareId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(deleteResponse.body.status).toBe('SUCCESS');

      // 삭제된 URL 접근 시도
      const accessResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${shareUrlToManage}`)
        .expect(404);

      expect(accessResponse.body.status).toBe('ERROR');
    });
  });

  describe('Share URL Security', () => {
    it('should not allow unauthorized user to create share URL', async () => {
      const unauthorizedResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PUBLIC,
        })
        .expect(401);

      expect(unauthorizedResponse.body.message).toContain('Unauthorized');
    });

    it('should not allow user to share another user\'s dashboard', async () => {
      // 다른 사용자 생성
      const otherUser = await userRepository.save({
        userId: 'otheruser',
        email: 'other@example.com',
        password: 'otherpass123',
        name: 'Other User',
      });

      // 다른 사용자의 대시보드 생성
      const otherDashboard = await dashboardRepository.save({
        title: 'Other User Dashboard',
        layout: [],
        userId: otherUser.id,
      });

      // 원래 사용자가 다른 사용자의 대시보드를 공유하려고 시도
      const unauthorizedShareResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: otherDashboard.id,
          shareType: ShareType.PUBLIC,
        })
        .expect(403);

      expect(unauthorizedShareResponse.body.status).toBe('ERROR');

      // 정리
      await dashboardRepository.delete({ id: otherDashboard.id });
      await userRepository.delete({ id: otherUser.id });
    });

    it('should handle expired share URLs', async () => {
      // 이미 만료된 공유 URL 생성 (직접 DB에 저장)
      const expiredShare = await shareUrlRepository.save({
        dashboardId: testDashboardId,
        shareUrl: 'expired-test-url',
        shareType: ShareType.PUBLIC,
        expiredAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 어제 만료
        isActive: true,
        userId: userId,
      });

      // 만료된 URL 접근 시도
      const accessResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${expiredShare.shareUrl}`)
        .expect(403);

      expect(accessResponse.body.status).toBe('ERROR');
      expect(accessResponse.body.message).toContain('expired');

      // 정리
      await shareUrlRepository.delete({ id: expiredShare.id });
    });
  });

  describe('Share URL Data Access', () => {
    let dataAccessShareUrl: string;

    beforeEach(async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PUBLIC,
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .expect(201);

      dataAccessShareUrl = createResponse.body.data.shareUrl;
    });

    it('should load dashboard with widgets through share URL', async () => {
      const dashboardResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${dataAccessShareUrl}`)
        .expect(200);

      expect(dashboardResponse.body.status).toBe('SUCCESS');
      expect(dashboardResponse.body.data.dashboard).toBeDefined();
      expect(dashboardResponse.body.data.widgets).toBeDefined();
      expect(Array.isArray(dashboardResponse.body.data.widgets)).toBe(true);
      expect(dashboardResponse.body.data.widgets.length).toBeGreaterThan(0);
    });

    it('should execute widget queries through share URL', async () => {
      const widgetDataResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${dataAccessShareUrl}/widget/${testWidgetId}/data`)
        .expect(200);

      expect(widgetDataResponse.body.status).toBe('SUCCESS');
      // 실제 데이터베이스가 없을 수 있으므로 응답 구조만 확인
      expect(widgetDataResponse.body).toHaveProperty('data');
    });

    it('should not allow data modification through share URL', async () => {
      // 대시보드 수정 시도
      const modifyDashboardResponse = await request(app.getHttpServer())
        .patch(`/api/share-url/${dataAccessShareUrl}/dashboard`)
        .send({
          title: 'Modified Title',
        })
        .expect(405); // Method Not Allowed

      // 위젯 수정 시도
      const modifyWidgetResponse = await request(app.getHttpServer())
        .patch(`/api/share-url/${dataAccessShareUrl}/widget/${testWidgetId}`)
        .send({
          name: 'Modified Widget',
        })
        .expect(405); // Method Not Allowed
    });
  });

  describe('Share URL Statistics', () => {
    let statsShareUrl: string;
    let statsShareId: number;

    beforeEach(async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/share-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          dashboardId: testDashboardId,
          shareType: ShareType.PUBLIC,
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .expect(201);

      statsShareUrl = createResponse.body.data.shareUrl;
      statsShareId = createResponse.body.data.id;

      // 여러 번 접근하여 통계 생성
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get(`/api/share-url/${statsShareUrl}`)
          .expect(200);
      }
    });

    it('should get share URL statistics', async () => {
      const statsResponse = await request(app.getHttpServer())
        .get(`/api/share-url/${statsShareId}/stats`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(statsResponse.body.status).toBe('SUCCESS');
      expect(statsResponse.body.data).toHaveProperty('accessCount');
      expect(statsResponse.body.data.accessCount).toBeGreaterThanOrEqual(5);
      expect(statsResponse.body.data).toHaveProperty('lastAccessedAt');
    });

    it('should get all share URLs statistics for user', async () => {
      const userStatsResponse = await request(app.getHttpServer())
        .get('/api/share-url/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(userStatsResponse.body.status).toBe('SUCCESS');
      expect(userStatsResponse.body.data).toHaveProperty('totalShares');
      expect(userStatsResponse.body.data).toHaveProperty('activeShares');
      expect(userStatsResponse.body.data).toHaveProperty('totalAccessCount');
    });
  });

  describe('Share URL Batch Operations', () => {
    let batchShareIds: number[] = [];

    beforeEach(async () => {
      // 여러 개의 공유 URL 생성
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/share-url')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            dashboardId: testDashboardId,
            shareType: ShareType.PUBLIC,
            expiredAt: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
          })
          .expect(201);

        batchShareIds.push(response.body.data.id);
      }
    });

    it('should batch deactivate share URLs', async () => {
      const batchDeactivateResponse = await request(app.getHttpServer())
        .patch('/api/share-url/batch/deactivate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shareIds: batchShareIds,
        })
        .expect(200);

      expect(batchDeactivateResponse.body.status).toBe('SUCCESS');
      expect(batchDeactivateResponse.body.data.affected).toBe(batchShareIds.length);
    });

    it('should batch delete share URLs', async () => {
      const batchDeleteResponse = await request(app.getHttpServer())
        .delete('/api/share-url/batch')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          shareIds: batchShareIds,
        })
        .expect(200);

      expect(batchDeleteResponse.body.status).toBe('SUCCESS');
      expect(batchDeleteResponse.body.data.deleted).toBe(batchShareIds.length);
    });
  });
});