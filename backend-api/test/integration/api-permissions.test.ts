import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PermissionTestUtils } from '../utils/permission-test.utils';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '../../src/modules/admin/entities/role.entity';
import { User } from '../../src/user/entities/user.entity';

describe('API Permissions Integration Tests', () => {
  let app: INestApplication;
  let testUtils: PermissionTestUtils;
  let roleRepository: Repository<Role>;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    testUtils = new PermissionTestUtils(app);
    roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
    userRepository = app.get<Repository<User>>(getRepositoryToken(User));

    // 테스트용 기본 역할 생성
    await setupTestRoles();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupTestRoles() {
    const roles = [
      {
        name: 'super_admin',
        displayName: 'Super Admin',
        level: 100,
        permissions: ['*'], // 모든 권한
        isSystem: true,
      },
      {
        name: 'admin',
        displayName: 'Admin',
        level: 80,
        permissions: [
          'admin.users.view',
          'admin.users.create',
          'admin.users.update',
          'admin.users.delete',
          'admin.roles.view',
          'admin.audit.view',
        ],
        isSystem: true,
      },
      {
        name: 'manager',
        displayName: 'Manager',
        level: 60,
        permissions: [
          'dashboard.view',
          'reports.view',
          'reports.create',
        ],
        isSystem: true,
      },
      {
        name: 'editor',
        displayName: 'Editor',
        level: 40,
        permissions: [
          'dashboard.view',
          'dashboard.edit',
          'reports.view',
        ],
        isSystem: true,
      },
      {
        name: 'viewer',
        displayName: 'Viewer',
        level: 20,
        permissions: [
          'dashboard.view',
          'reports.view',
        ],
        isSystem: true,
      },
    ];

    for (const roleData of roles) {
      const existingRole = await roleRepository.findOne({ where: { name: roleData.name } });
      if (!existingRole) {
        await roleRepository.save(roleData);
      }
    }
  }

  describe('Admin User Management APIs', () => {
    describe('GET /admin/users', () => {
      it('should properly control access based on permissions', async () => {
        const scenarios = [
          {
            name: 'Super Admin - Full Access',
            roles: ['super_admin'],
            expectedResult: 200,
          },
          {
            name: 'Admin - Has Permission',
            roles: ['admin'],
            expectedResult: 200,
          },
          {
            name: 'Manager - No Permission',
            roles: ['manager'],
            expectedResult: 403,
          },
          {
            name: 'Editor - No Permission',
            roles: ['editor'],
            expectedResult: 403,
          },
          {
            name: 'Viewer - No Permission',
            roles: ['viewer'],
            expectedResult: 403,
          },
          {
            name: 'No Token - Unauthorized',
            roles: [],
            expectedResult: 401,
          },
        ];

        const results = await testUtils.testEndpointPermission(
          '/admin/users',
          'GET',
          ['admin.users.view'],
          scenarios,
        );

        results.forEach(result => {
          expect(result.passed).toBe(true);
          if (!result.passed) {
            console.error(`❌ ${result.scenario}: Expected ${result.expected}, Got ${result.actual}`);
          }
        });
      });
    });

    describe('POST /admin/users', () => {
      it('should only allow user creation with proper permissions', async () => {
        const scenarios = [
          {
            name: 'Super Admin - Create User',
            roles: ['super_admin'],
            requestData: {
              email: 'newuser@test.com',
              userId: 'new_user_1',
              name: 'New User',
              password: 'password123',
            },
            expectedResult: 201,
          },
          {
            name: 'Admin - Create User',
            roles: ['admin'],
            requestData: {
              email: 'newuser2@test.com',
              userId: 'new_user_2',
              name: 'New User 2',
              password: 'password123',
            },
            expectedResult: 201,
          },
          {
            name: 'Manager - No Permission',
            roles: ['manager'],
            requestData: {
              email: 'newuser3@test.com',
              userId: 'new_user_3',
              name: 'New User 3',
              password: 'password123',
            },
            expectedResult: 403,
          },
        ];

        const results = await testUtils.testEndpointPermission(
          '/admin/users',
          'POST',
          ['admin.users.create'],
          scenarios,
        );

        results.forEach(result => {
          expect(result.passed).toBe(true);
        });
      });
    });

    describe('PUT /admin/users/:id', () => {
      it('should control user update based on permissions', async () => {
        // 테스트용 사용자 생성
        const testUser = await userRepository.save({
          email: 'update-test@example.com',
          userId: 'update_test_user',
          name: 'Update Test User',
          password: 'test123',
          status: 'active',
        });

        const scenarios = [
          {
            name: 'Super Admin - Update User',
            roles: ['super_admin'],
            requestData: {
              name: 'Updated Name',
            },
            expectedResult: 200,
          },
          {
            name: 'Admin - Update User',
            roles: ['admin'],
            requestData: {
              name: 'Updated Name 2',
            },
            expectedResult: 200,
          },
          {
            name: 'Manager - No Permission',
            roles: ['manager'],
            requestData: {
              name: 'Updated Name 3',
            },
            expectedResult: 403,
          },
        ];

        const results = await testUtils.testEndpointPermission(
          `/admin/users/${testUser.id}`,
          'PUT',
          ['admin.users.update'],
          scenarios,
        );

        results.forEach(result => {
          expect(result.passed).toBe(true);
        });

        // 정리
        await userRepository.delete({ id: testUser.id });
      });
    });

    describe('DELETE /admin/users/:id', () => {
      it('should control user deletion based on permissions', async () => {
        const scenarios = [
          {
            name: 'Manager - No Permission',
            roles: ['manager'],
            expectedResult: 403,
          },
          {
            name: 'Admin - Has Permission',
            roles: ['admin'],
            expectedResult: 200,
          },
        ];

        for (const scenario of scenarios) {
          // 각 시나리오마다 새 사용자 생성
          const testUser = await userRepository.save({
            email: `delete-test-${Date.now()}@example.com`,
            userId: `delete_test_user_${Date.now()}`,
            name: 'Delete Test User',
            password: 'test123',
            status: 'active',
          });

          const results = await testUtils.testEndpointPermission(
            `/admin/users/${testUser.id}`,
            'DELETE',
            ['admin.users.delete'],
            [scenario],
          );

          results.forEach(result => {
            expect(result.passed).toBe(true);
          });

          // 삭제되지 않은 경우 정리
          const stillExists = await userRepository.findOne({ where: { id: testUser.id } });
          if (stillExists) {
            await userRepository.delete({ id: testUser.id });
          }
        }
      });
    });
  });

  describe('Role Management APIs', () => {
    describe('POST /admin/roles', () => {
      it('should prevent non-super-admin from creating roles', async () => {
        const { tokens } = await testUtils.createTestUser(['admin']);

        const response = await request(app.getHttpServer())
          .post('/admin/roles')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .send({
            name: 'test_role',
            displayName: 'Test Role',
            level: 50,
            permissions: ['test.permission'],
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Only super administrators can create roles');
      });

      it('should allow super-admin to create roles', async () => {
        const { tokens } = await testUtils.createTestUser(['super_admin']);

        const response = await request(app.getHttpServer())
          .post('/admin/roles')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .send({
            name: 'test_role_' + Date.now(),
            displayName: 'Test Role',
            level: 50,
            permissions: ['test.permission'],
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBeDefined();

        // 정리
        if (response.body.id) {
          await roleRepository.delete({ id: response.body.id });
        }
      });
    });

    describe('GET /admin/roles', () => {
      it('should control role list access', async () => {
        const scenarios = [
          {
            name: 'Super Admin - Can View',
            roles: ['super_admin'],
            expectedResult: 200,
          },
          {
            name: 'Admin - Can View',
            roles: ['admin'],
            expectedResult: 200,
          },
          {
            name: 'Manager - No Permission',
            roles: ['manager'],
            expectedResult: 403,
          },
        ];

        const results = await testUtils.testEndpointPermission(
          '/admin/roles',
          'GET',
          ['admin.roles.view'],
          scenarios,
        );

        results.forEach(result => {
          expect(result.passed).toBe(true);
        });
      });
    });
  });

  describe('Audit Log APIs', () => {
    describe('GET /admin/audit-logs', () => {
      it('should restrict audit log access by permission', async () => {
        const scenarios = [
          { roles: ['super_admin'], expectedResult: 200 },
          { roles: ['admin'], expectedResult: 200 },
          { roles: ['manager'], expectedResult: 403 },
          { roles: ['editor'], expectedResult: 403 },
          { roles: ['viewer'], expectedResult: 403 },
        ];

        const results = await testUtils.testEndpointPermission(
          '/admin/audit-logs',
          'GET',
          ['admin.audit.view'],
          scenarios.map(s => ({
            name: `${s.roles[0]} role access`,
            roles: s.roles,
            expectedResult: s.expectedResult,
          })),
        );

        results.forEach(result => {
          expect(result.passed).toBe(true);
        });
      });
    });

    describe('GET /admin/audit-logs/export', () => {
      it('should require export permission', async () => {
        const scenarios = [
          {
            name: 'Admin without export permission',
            roles: ['admin'],
            expectedResult: 403,
          },
          {
            name: 'Super Admin with all permissions',
            roles: ['super_admin'],
            expectedResult: 200,
          },
        ];

        const results = await testUtils.testEndpointPermission(
          '/admin/audit-logs/export',
          'GET',
          ['admin.audit.export'],
          scenarios,
        );

        results.forEach(result => {
          expect(result.passed).toBe(true);
        });
      });
    });
  });

  describe('Cross-cutting Permission Concerns', () => {
    it('should handle expired tokens properly', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjF9.1c_yQjnMZfKUb4UTDE_WvbC71f8xxtyMsdqKKkI1hF8';

      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should handle malformed tokens', async () => {
      const malformedToken = 'not.a.valid.token';

      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });
});