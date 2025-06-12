import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

/**
 * Mock repository factory
 * TypeORM Repository를 모킹하기 위한 팩토리 함수
 */
export const createMockRepository = <T = any>(): Partial<Repository<T>> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  })) as any,
});

/**
 * Mock JwtService
 * JWT 서비스를 모킹하기 위한 팩토리 함수
 */
export const createMockJwtService = (): Partial<JwtService> => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 1, email: 'test@example.com' }),
  verifyAsync: jest.fn().mockResolvedValue({ userId: 1, email: 'test@example.com' }),
  decode: jest.fn().mockReturnValue({ userId: 1, email: 'test@example.com' }),
});

/**
 * 엔티티 클래스에 대한 Repository 토큰 생성 헬퍼
 */
export const getRepositoryTokenFor = (entity: any) => getRepositoryToken(entity);

/**
 * 공통 테스트 데이터
 */
export const mockUser = {
  id: 1,
  userId: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDashboard = {
  id: 1,
  title: 'Test Dashboard',
  layout: '[]',
  shareId: 1,
  delYn: 'N',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockWidget = {
  id: 1,
  title: 'Test Widget',
  widgetType: 'chart',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDatabase = {
  id: 1,
  name: 'Test Database',
  host: 'localhost',
  port: 3306,
  username: 'testuser',
  password: 'testpass',
  databaseName: 'testdb',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDataset = {
  id: 1,
  name: 'Test Dataset',
  query: 'SELECT * FROM test',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * 공통 서비스 Mock 팩토리
 */
export const createMockService = <T = any>(methods: string[] = []): Partial<T> => {
  const mockService: any = {};
  methods.forEach(method => {
    mockService[method] = jest.fn();
  });
  return mockService;
};

/**
 * 기본 서비스 메서드들에 대한 Mock
 */
export const defaultServiceMethods = [
  'create',
  'findAll',
  'findOne',
  'update',
  'remove',
  'save',
  'delete',
];

/**
 * 환경 변수 Mock 헬퍼
 */
export const mockEnvVars = {
  ACCESS_SECRET: 'test-access-secret',
  REFRESH_SECRET: 'test-refresh-secret',
  URL_ACCESS_SECRET: 'test-url-access-secret',
  NODE_ENV: 'test',
};

/**
 * 테스트 모듈 생성을 위한 공통 provider 설정
 */
export const createTestProviders = (service: any, dependencies: any[] = []) => {
  const providers = [service];

  dependencies.forEach(dep => {
    if (dep.useFactory) {
      providers.push(dep);
    } else if (dep.entity) {
      providers.push({
        provide: getRepositoryToken(dep.entity),
        useValue: createMockRepository(),
      });
    } else if (dep.service) {
      providers.push({
        provide: dep.service,
        useValue: createMockService(dep.methods || defaultServiceMethods),
      });
    }
  });

  return providers;
};
