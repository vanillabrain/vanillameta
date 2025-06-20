import { CustomLoggerService } from '../../src/common/logger/logger.service';
import { SqlValidationService } from '../../src/common/security/sql-validation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../src/user/entities/user.entity';
import { UserService } from '../../src/user/user.service';
import { AuthService } from '../../src/auth/auth.service';
import { DashboardShare } from '../../src/dashboard/entities/dashboard_share.entity';
import { UserMapping } from '../../src/user/entities/user-mapping.entity';
import { PaginationService } from '../../src/common/pagination/pagination.service';

// Mock CustomLoggerService
export const mockCustomLoggerService = {
  provide: CustomLoggerService,
  useValue: {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  },
};

// Mock SqlValidationService
export const mockSqlValidationService = {
  provide: SqlValidationService,
  useValue: {
    validate: jest.fn().mockReturnValue(true),
    validateQuery: jest.fn().mockReturnValue(true),
    validateDatabaseName: jest.fn().mockReturnValue(true),
    validateTableName: jest.fn().mockReturnValue(true),
  },
};

// Mock UserRepository
export const mockUserRepository = {
  provide: getRepositoryToken(User),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock UserService
export const mockUserService = {
  provide: UserService,
  useValue: {
    findByEmailAndCompanyId: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
};

// Mock AuthService
export const mockAuthService = {
  provide: AuthService,
  useValue: {
    login: jest.fn(),
    validateUser: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    generateUrlAccessToken: jest.fn(),
  },
};

// Mock DashboardShareRepository
export const mockDashboardShareRepository = {
  provide: getRepositoryToken(DashboardShare),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock UserMappingRepository
export const mockUserMappingRepository = {
  provide: getRepositoryToken(UserMapping),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock PaginationService
export const mockPaginationService = {
  provide: PaginationService,
  useValue: {
    paginateOffset: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
    }),
    paginateCursor: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
    }),
  },
};

// Common test providers
export const commonTestProviders = [
  mockCustomLoggerService,
  mockSqlValidationService,
  mockUserRepository,
  mockUserService,
  mockAuthService,
  mockDashboardShareRepository,
  mockUserMappingRepository,
  mockPaginationService,
];
