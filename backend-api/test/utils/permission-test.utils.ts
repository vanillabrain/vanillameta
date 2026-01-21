import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { Role } from '../../src/modules/admin/entities/role.entity';
import { UserRole } from '../../src/modules/admin/entities/user-role.entity';
import { AuthService } from '../../src/auth/auth.service';
import * as request from 'supertest';
import * as crypto from 'crypto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PermissionTestScenario {
  name: string;
  roles: string[];
  customPermissions?: string[];
  requestData?: any;
  expectedResult: number; // HTTP status code
}

export interface PermissionTestResult {
  scenario: string;
  expected: number;
  actual: number;
  passed: boolean;
  details?: any;
  error?: string;
}

export class PermissionTestUtils {
  private app: INestApplication;
  private userRepository: Repository<User>;
  private roleRepository: Repository<Role>;
  private userRoleRepository: Repository<UserRole>;
  private authService: AuthService;

  constructor(app: INestApplication) {
    this.app = app;
    this.userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    this.roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
    this.userRoleRepository = app.get<Repository<UserRole>>(getRepositoryToken(UserRole));
    this.authService = app.get<AuthService>(AuthService);
  }

  async createTestUser(
    roleNames: string[],
    customPermissions?: string[],
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const timestamp = Date.now();
    const user = await this.userRepository.save({
      email: `test-${timestamp}@example.com`,
      userId: `test_user_${timestamp}`,
      name: `Test User ${timestamp}`,
      password: crypto.createHash('sha512').update('test123').digest('hex'),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 역할 할당
    for (const roleName of roleNames) {
      const role = await this.roleRepository.findOne({ where: { name: roleName } });
      if (role) {
        await this.userRoleRepository.save({
          userId: user.id.toString(),
          roleId: role.id,
          assignedBy: user.id.toString(),
        });
      }
    }

    // 커스텀 권한 추가 (필요한 경우)
    if (customPermissions && customPermissions.length > 0) {
      // 커스텀 권한을 위한 임시 역할 생성
      const customRole = await this.roleRepository.save({
        name: `custom_role_${timestamp}`,
        displayName: 'Custom Test Role',
        permissions: customPermissions,
        level: 1,
        isSystem: false,
      });

      await this.userRoleRepository.save({
        userId: user.id.toString(),
        roleId: customRole.id,
        assignedBy: user.id.toString(),
      });
    }

    // 토큰 생성
    const accessToken = await this.authService.generateAccessToken(user);
    const refreshToken = await this.authService.generateRefreshToken(user);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async testEndpointPermission(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    requiredPermissions: string[],
    testScenarios: PermissionTestScenario[],
  ): Promise<PermissionTestResult[]> {
    const results: PermissionTestResult[] = [];

    for (const scenario of testScenarios) {
      let user: User | null = null;
      let tokens: AuthTokens | null = null;

      try {
        if (scenario.roles.length > 0 || scenario.customPermissions) {
          const result = await this.createTestUser(scenario.roles, scenario.customPermissions);
          user = result.user;
          tokens = result.tokens;
        }

        const requestBuilder = request(this.app.getHttpServer())[method.toLowerCase()](endpoint);

        if (tokens) {
          requestBuilder.set('Authorization', `Bearer ${tokens.accessToken}`);
        }

        if (scenario.requestData) {
          requestBuilder.send(scenario.requestData);
        }

        const response = await requestBuilder;

        results.push({
          scenario: scenario.name,
          expected: scenario.expectedResult,
          actual: response.status,
          passed: response.status === scenario.expectedResult,
          details: response.body,
        });
      } catch (error) {
        results.push({
          scenario: scenario.name,
          expected: scenario.expectedResult,
          actual: error.response?.status || 500,
          passed: false,
          error: error.message,
        });
      } finally {
        // 테스트 사용자 정리
        if (user) {
          await this.cleanupTestUser(user.id);
        }
      }
    }

    return results;
  }

  async cleanupTestUser(userId: number): Promise<void> {
    // 사용자 역할 삭제
    await this.userRoleRepository.delete({ userId: userId.toString() });
    
    // 사용자 삭제
    await this.userRepository.delete({ id: userId });
  }

  async getAllRoles(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  async getRolePermissions(roleName: string): Promise<string[]> {
    const role = await this.roleRepository.findOne({ where: { name: roleName } });
    return role?.permissions || [];
  }

  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { name: roleName } });
    if (role) {
      await this.userRoleRepository.save({
        userId,
        roleId: role.id,
        assignedBy: userId,
      });
    }
  }

  async createAuditLog(data: any): Promise<void> {
    const auditLogRepository = this.app.get('AuditLogRepository');
    await auditLogRepository.save(data);
  }

  async makeRequest(
    endpoint: string,
    method: string,
    options: { headers?: any; data?: any; query?: any },
  ): Promise<any> {
    const req = request(this.app.getHttpServer())[method.toLowerCase()](endpoint);

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        req.set(key, value as string);
      });
    }

    if (options.query) {
      req.query(options.query);
    }

    if (options.data) {
      req.send(options.data);
    }

    return req;
  }
}