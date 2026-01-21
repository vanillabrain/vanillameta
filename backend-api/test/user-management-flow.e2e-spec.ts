import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { Dashboard } from '../src/dashboard/entities/dashboard.entity';
import { ShareUrl } from '../src/share-url/entities/share-url.entity';
import * as bcrypt from 'bcryptjs';

describe('User Management Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let dashboardRepository: Repository<Dashboard>;
  let shareUrlRepository: Repository<ShareUrl>;

  const adminUser = {
    userId: 'admin',
    email: 'admin@vanillameta.com',
    password: 'admin123!@#',
    name: 'Admin User',
    isAdmin: true,
    isActive: true,
  };

  const testUser = {
    userId: 'testuser',
    email: 'test@example.com',
    password: 'test123!@#',
    name: 'Test User',
    isAdmin: false,
    isActive: true,
  };

  let adminAccessToken: string;
  let userAccessToken: string;
  let adminId: number;
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    dashboardRepository = moduleFixture.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    shareUrlRepository = moduleFixture.get<Repository<ShareUrl>>(getRepositoryToken(ShareUrl));

    // 관리자 계정 생성
    const hashedAdminPassword = await bcrypt.hash(adminUser.password, 10);
    const savedAdmin = await userRepository.save({
      ...adminUser,
      password: hashedAdminPassword,
    });
    adminId = savedAdmin.id;

    // 일반 사용자 계정 생성
    const hashedUserPassword = await bcrypt.hash(testUser.password, 10);
    const savedUser = await userRepository.save({
      ...testUser,
      password: hashedUserPassword,
    });
    userId = savedUser.id;

    // 관리자 로그인
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: adminUser.userId,
        password: adminUser.password,
      })
      .expect(201);

    adminAccessToken = adminLoginResponse.body.accessToken;

    // 일반 사용자 로그인
    const userLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    userAccessToken = userLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await shareUrlRepository.delete({});
    await dashboardRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('User Registration', () => {
    it('should register new user', async () => {
      const newUser = {
        userId: 'newuser',
        email: 'newuser@example.com',
        password: 'newpass123!@#',
        name: 'New User',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/api/user/register')
        .send(newUser)
        .expect(201);

      expect(registerResponse.body.status).toBe('SUCCESS');
      expect(registerResponse.body.data).toHaveProperty('id');
      expect(registerResponse.body.data.userId).toBe(newUser.userId);
      expect(registerResponse.body.data.email).toBe(newUser.email);
      expect(registerResponse.body.data).not.toHaveProperty('password');
    });

    it('should reject duplicate userId', async () => {
      const duplicateUser = {
        userId: 'testuser', // 이미 존재하는 userId
        email: 'different@example.com',
        password: 'pass123!@#',
        name: 'Duplicate User',
      };

      const duplicateResponse = await request(app.getHttpServer())
        .post('/api/user/register')
        .send(duplicateUser)
        .expect(409);

      expect(duplicateResponse.body.status).toBe('ERROR');
      expect(duplicateResponse.body.message).toContain('already exists');
    });

    it('should reject duplicate email', async () => {
      const duplicateEmail = {
        userId: 'uniqueuser',
        email: 'test@example.com', // 이미 존재하는 email
        password: 'pass123!@#',
        name: 'Duplicate Email User',
      };

      const duplicateResponse = await request(app.getHttpServer())
        .post('/api/user/register')
        .send(duplicateEmail)
        .expect(409);

      expect(duplicateResponse.body.status).toBe('ERROR');
    });

    it('should validate password strength', async () => {
      const weakPasswordUser = {
        userId: 'weakpass',
        email: 'weak@example.com',
        password: '123', // 약한 비밀번호
        name: 'Weak Password User',
      };

      const weakPasswordResponse = await request(app.getHttpServer())
        .post('/api/user/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(weakPasswordResponse.body.status).toBe('ERROR');
      expect(weakPasswordResponse.body.message).toContain('password');
    });

    it('should validate email format', async () => {
      const invalidEmailUser = {
        userId: 'invalidemail',
        email: 'not-an-email', // 잘못된 이메일 형식
        password: 'valid123!@#',
        name: 'Invalid Email User',
      };

      const invalidEmailResponse = await request(app.getHttpServer())
        .post('/api/user/register')
        .send(invalidEmailUser)
        .expect(400);

      expect(invalidEmailResponse.body.status).toBe('ERROR');
    });
  });

  describe('User Profile Management', () => {
    it('should get own profile', async () => {
      const profileResponse = await request(app.getHttpServer())
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(profileResponse.body.status).toBe('SUCCESS');
      expect(profileResponse.body.data.userId).toBe(testUser.userId);
      expect(profileResponse.body.data.email).toBe(testUser.email);
      expect(profileResponse.body.data).not.toHaveProperty('password');
    });

    it('should update own profile', async () => {
      const updateData = {
        name: 'Updated Test User',
        email: 'updated@example.com',
      };

      const updateResponse = await request(app.getHttpServer())
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.status).toBe('SUCCESS');
      expect(updateResponse.body.data.name).toBe(updateData.name);
      expect(updateResponse.body.data.email).toBe(updateData.email);
    });

    it('should change password', async () => {
      const passwordChangeData = {
        currentPassword: testUser.password,
        newPassword: 'newpass123!@#',
      };

      const changePasswordResponse = await request(app.getHttpServer())
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(passwordChangeData)
        .expect(200);

      expect(changePasswordResponse.body.status).toBe('SUCCESS');

      // 새 비밀번호로 로그인 테스트
      const newLoginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: testUser.userId,
          password: passwordChangeData.newPassword,
        })
        .expect(201);

      expect(newLoginResponse.body).toHaveProperty('accessToken');

      // 테스트를 위해 원래 비밀번호로 되돌리기
      await request(app.getHttpServer())
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          currentPassword: passwordChangeData.newPassword,
          newPassword: testUser.password,
        })
        .expect(200);
    });

    it('should reject wrong current password', async () => {
      const wrongPasswordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpass123!@#',
      };

      const wrongPasswordResponse = await request(app.getHttpServer())
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(wrongPasswordData)
        .expect(401);

      expect(wrongPasswordResponse.body.status).toBe('ERROR');
    });

    it('should upload profile picture', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/user/profile-picture')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .attach('file', Buffer.from('fake-image-data'), {
          filename: 'profile.jpg',
          contentType: 'image/jpeg',
        })
        .expect(200);

      expect(uploadResponse.body.status).toBe('SUCCESS');
      expect(uploadResponse.body.data).toHaveProperty('profilePictureUrl');
    });
  });

  describe('User Administration (Admin Only)', () => {
    it('should list all users as admin', async () => {
      const listUsersResponse = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(listUsersResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(listUsersResponse.body.data)).toBe(true);
      expect(listUsersResponse.body.data.length).toBeGreaterThan(0);
    });

    it('should reject user listing for non-admin', async () => {
      const unauthorizedResponse = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);

      expect(unauthorizedResponse.body.status).toBe('ERROR');
    });

    it('should get specific user details as admin', async () => {
      const userDetailsResponse = await request(app.getHttpServer())
        .get(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(userDetailsResponse.body.status).toBe('SUCCESS');
      expect(userDetailsResponse.body.data.id).toBe(userId);
    });

    it('should update user status as admin', async () => {
      const statusUpdateResponse = await request(app.getHttpServer())
        .patch(`/api/user/${userId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          isActive: false,
        })
        .expect(200);

      expect(statusUpdateResponse.body.status).toBe('SUCCESS');
      expect(statusUpdateResponse.body.data.isActive).toBe(false);

      // 상태 복원
      await request(app.getHttpServer())
        .patch(`/api/user/${userId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          isActive: true,
        })
        .expect(200);
    });

    it('should promote user to admin', async () => {
      // 새 사용자 생성
      const newUser = await userRepository.save({
        userId: 'promoteuser',
        email: 'promote@example.com',
        password: await bcrypt.hash('pass123!@#', 10),
        name: 'Promote User',
        isAdmin: false,
      });

      const promoteResponse = await request(app.getHttpServer())
        .patch(`/api/user/${newUser.id}/role`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          isAdmin: true,
        })
        .expect(200);

      expect(promoteResponse.body.status).toBe('SUCCESS');
      expect(promoteResponse.body.data.isAdmin).toBe(true);

      // 정리
      await userRepository.delete({ id: newUser.id });
    });

    it('should reset user password as admin', async () => {
      const resetPasswordResponse = await request(app.getHttpServer())
        .post(`/api/user/${userId}/reset-password`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          newPassword: 'resetpass123!@#',
        })
        .expect(200);

      expect(resetPasswordResponse.body.status).toBe('SUCCESS');
      expect(resetPasswordResponse.body.data).toHaveProperty('temporaryPassword');
    });

    it('should delete user as admin', async () => {
      // 삭제할 사용자 생성
      const deleteUser = await userRepository.save({
        userId: 'deleteuser',
        email: 'delete@example.com',
        password: await bcrypt.hash('pass123!@#', 10),
        name: 'Delete User',
      });

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/user/${deleteUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(deleteResponse.body.status).toBe('SUCCESS');

      // 삭제 확인
      const getDeletedResponse = await request(app.getHttpServer())
        .get(`/api/user/${deleteUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);

      expect(getDeletedResponse.body.status).toBe('ERROR');
    });
  });

  describe('User Search and Filtering', () => {
    beforeEach(async () => {
      // 검색 테스트를 위한 사용자들 생성
      const testUsers = [
        {
          userId: 'john_doe',
          email: 'john@example.com',
          name: 'John Doe',
          isActive: true,
        },
        {
          userId: 'jane_smith',
          email: 'jane@example.com',
          name: 'Jane Smith',
          isActive: true,
        },
        {
          userId: 'inactive_user',
          email: 'inactive@example.com',
          name: 'Inactive User',
          isActive: false,
        },
      ];

      for (const user of testUsers) {
        await userRepository.save({
          ...user,
          password: await bcrypt.hash('pass123!@#', 10),
        });
      }
    });

    it('should search users by name', async () => {
      const searchResponse = await request(app.getHttpServer())
        .get('/api/user?search=john')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(searchResponse.body.status).toBe('SUCCESS');
      const results = searchResponse.body.data;
      expect(results.some(u => u.name.toLowerCase().includes('john'))).toBe(true);
    });

    it('should filter users by status', async () => {
      const activeUsersResponse = await request(app.getHttpServer())
        .get('/api/user?isActive=true')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(activeUsersResponse.body.status).toBe('SUCCESS');
      const activeUsers = activeUsersResponse.body.data;
      expect(activeUsers.every(u => u.isActive === true)).toBe(true);

      const inactiveUsersResponse = await request(app.getHttpServer())
        .get('/api/user?isActive=false')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const inactiveUsers = inactiveUsersResponse.body.data;
      expect(inactiveUsers.every(u => u.isActive === false)).toBe(true);
    });

    it('should paginate user results', async () => {
      const paginatedResponse = await request(app.getHttpServer())
        .get('/api/user?page=1&limit=2')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(paginatedResponse.body.status).toBe('SUCCESS');
      expect(paginatedResponse.body.data).toHaveProperty('items');
      expect(paginatedResponse.body.data).toHaveProperty('total');
      expect(paginatedResponse.body.data).toHaveProperty('page');
      expect(paginatedResponse.body.data).toHaveProperty('limit');
      expect(paginatedResponse.body.data.items.length).toBeLessThanOrEqual(2);
    });

    it('should sort users', async () => {
      const sortedByNameResponse = await request(app.getHttpServer())
        .get('/api/user?sort=name&order=asc')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(sortedByNameResponse.body.status).toBe('SUCCESS');
      const users = sortedByNameResponse.body.data;
      
      // 이름순으로 정렬되었는지 확인
      for (let i = 1; i < users.length; i++) {
        expect(users[i].name.localeCompare(users[i-1].name)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('User Activity and Analytics', () => {
    it('should get user activity log', async () => {
      const activityResponse = await request(app.getHttpServer())
        .get(`/api/user/${userId}/activity`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(activityResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(activityResponse.body.data)).toBe(true);
    });

    it('should get user statistics', async () => {
      // 사용자를 위한 테스트 데이터 생성
      await dashboardRepository.save({
        title: 'User Dashboard',
        layout: [],
        userId: userId,
      });

      const statsResponse = await request(app.getHttpServer())
        .get(`/api/user/${userId}/stats`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(statsResponse.body.status).toBe('SUCCESS');
      expect(statsResponse.body.data).toHaveProperty('dashboardCount');
      expect(statsResponse.body.data).toHaveProperty('widgetCount');
      expect(statsResponse.body.data).toHaveProperty('lastLogin');
    });

    it('should get system-wide user analytics', async () => {
      const analyticsResponse = await request(app.getHttpServer())
        .get('/api/user/analytics')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(analyticsResponse.body.status).toBe('SUCCESS');
      expect(analyticsResponse.body.data).toHaveProperty('totalUsers');
      expect(analyticsResponse.body.data).toHaveProperty('activeUsers');
      expect(analyticsResponse.body.data).toHaveProperty('newUsersThisMonth');
    });
  });

  describe('User Permissions and Access Control', () => {
    it('should get user permissions', async () => {
      const permissionsResponse = await request(app.getHttpServer())
        .get(`/api/user/${userId}/permissions`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(permissionsResponse.body.status).toBe('SUCCESS');
      expect(permissionsResponse.body.data).toHaveProperty('canCreateDashboard');
      expect(permissionsResponse.body.data).toHaveProperty('canShareDashboard');
      expect(permissionsResponse.body.data).toHaveProperty('maxDashboards');
    });

    it('should update user permissions', async () => {
      const updatePermissionsResponse = await request(app.getHttpServer())
        .patch(`/api/user/${userId}/permissions`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          canCreateDashboard: false,
          maxDashboards: 5,
        })
        .expect(200);

      expect(updatePermissionsResponse.body.status).toBe('SUCCESS');
      expect(updatePermissionsResponse.body.data.canCreateDashboard).toBe(false);
      expect(updatePermissionsResponse.body.data.maxDashboards).toBe(5);
    });
  });

  describe('User Import/Export', () => {
    it('should export users as CSV', async () => {
      const exportResponse = await request(app.getHttpServer())
        .get('/api/user/export/csv')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(exportResponse.headers['content-type']).toContain('text/csv');
      expect(exportResponse.headers['content-disposition']).toContain('attachment');
    });

    it('should import users from CSV', async () => {
      const csvContent = `userId,email,name,isActive
importuser1,import1@example.com,Import User 1,true
importuser2,import2@example.com,Import User 2,true`;

      const importResponse = await request(app.getHttpServer())
        .post('/api/user/import/csv')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .attach('file', Buffer.from(csvContent), {
          filename: 'users.csv',
          contentType: 'text/csv',
        })
        .expect(200);

      expect(importResponse.body.status).toBe('SUCCESS');
      expect(importResponse.body.data).toHaveProperty('imported');
      expect(importResponse.body.data).toHaveProperty('failed');
      expect(importResponse.body.data.imported).toBeGreaterThan(0);
    });
  });

  describe('User Session Management', () => {
    it('should get active sessions', async () => {
      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/user/sessions')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(sessionsResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(sessionsResponse.body.data)).toBe(true);
    });

    it('should revoke specific session', async () => {
      // 먼저 현재 세션 목록 가져오기
      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/user/sessions')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      if (sessionsResponse.body.data.length > 0) {
        const sessionId = sessionsResponse.body.data[0].id;

        const revokeResponse = await request(app.getHttpServer())
          .delete(`/api/user/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(200);

        expect(revokeResponse.body.status).toBe('SUCCESS');
      }
    });

    it('should revoke all sessions except current', async () => {
      const revokeAllResponse = await request(app.getHttpServer())
        .post('/api/user/sessions/revoke-all')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(revokeAllResponse.body.status).toBe('SUCCESS');
      expect(revokeAllResponse.body.data).toHaveProperty('revokedCount');
    });
  });

  describe('User Data Privacy', () => {
    it('should export user data (GDPR)', async () => {
      const dataExportResponse = await request(app.getHttpServer())
        .get('/api/user/data-export')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(dataExportResponse.body.status).toBe('SUCCESS');
      expect(dataExportResponse.body.data).toHaveProperty('personalData');
      expect(dataExportResponse.body.data).toHaveProperty('dashboards');
      expect(dataExportResponse.body.data).toHaveProperty('activityLog');
    });

    it('should request account deletion', async () => {
      // 삭제할 사용자 생성
      const deleteUser = await userRepository.save({
        userId: 'gdpruser',
        email: 'gdpr@example.com',
        password: await bcrypt.hash('pass123!@#', 10),
        name: 'GDPR User',
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: 'gdpruser',
          password: 'pass123!@#',
        })
        .expect(201);

      const deleteToken = loginResponse.body.accessToken;

      const deletionResponse = await request(app.getHttpServer())
        .post('/api/user/request-deletion')
        .set('Authorization', `Bearer ${deleteToken}`)
        .send({
          confirmPassword: 'pass123!@#',
          reason: 'No longer need the service',
        })
        .expect(200);

      expect(deletionResponse.body.status).toBe('SUCCESS');
      expect(deletionResponse.body.data).toHaveProperty('deletionScheduledAt');
    });
  });
});