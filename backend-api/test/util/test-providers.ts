import { CustomLoggerService } from '../../src/common/logger/logger.service';
import { SqlValidationService } from '../../src/common/security/sql-validation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../src/user/entities/user.entity';
import { UserService } from '../../src/user/user.service';
import { AuthService } from '../../src/auth/auth.service';
import { DashboardShare } from '../../src/dashboard/entities/dashboard_share.entity';
import { UserMapping } from '../../src/user/entities/user-mapping.entity';
import { PaginationService } from '../../src/common/pagination/pagination.service';
import { Database } from '../../src/database/entities/database.entity';
import { Dataset } from '../../src/dataset/entities/dataset.entity';
import { Widget } from '../../src/widget/entities/widget.entity';
import { Component } from '../../src/component/entities/component.entity';
import { ConnectionService } from '../../src/connection/connection.service';
import { HybridCacheService } from '../../src/common/cache/hybrid-cache.service';
import { BusinessMetricsService } from '../../src/common/metrics/business-metrics.service';
import { DatabaseOptimizerFactory } from '../../src/database/optimizer/database-optimizer.factory';
import { REQUEST } from '@nestjs/core';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../../src/dashboard/entities/dashboard-widget.entity';
import { DashboardCacheService } from '../../src/dashboard/dashboard-cache.service';
import { DashboardWidgetService } from '../../src/dashboard/dashboard-widget.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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

// Mock Database Repository
export const mockDatabaseRepository = {
  provide: getRepositoryToken(Database),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock Dataset Repository
export const mockDatasetRepository = {
  provide: getRepositoryToken(Dataset),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock Widget Repository
export const mockWidgetRepository = {
  provide: getRepositoryToken(Widget),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    }),
  },
};

// Mock Component Repository
export const mockComponentRepository = {
  provide: getRepositoryToken(Component),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock ConnectionService
export const mockConnectionService = {
  provide: ConnectionService,
  useValue: {
    testConnection: jest.fn().mockResolvedValue(true),
    executeQuery: jest.fn().mockResolvedValue({ rows: [] }),
    getConnection: jest.fn(),
    addKnex: jest.fn(),
    removeKnex: jest.fn(),
  },
};

// Mock HybridCacheService
export const mockHybridCacheService = {
  provide: HybridCacheService,
  useValue: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    clear: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  },
};

// Mock BusinessMetricsService
export const mockBusinessMetricsService = {
  provide: BusinessMetricsService,
  useValue: {
    recordQueryExecution: jest.fn(),
    recordDashboardView: jest.fn(),
    recordWidgetCreation: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue({}),
  },
};

// Mock DatabaseOptimizerFactory
export const mockDatabaseOptimizerFactory = {
  provide: DatabaseOptimizerFactory,
  useValue: {
    getOptimizer: jest.fn().mockReturnValue({
      getOptimizedConnectionConfig: jest.fn().mockReturnValue({}),
      getDatabaseType: jest.fn().mockReturnValue('mysql'),
    }),
  },
};

// Mock REQUEST
export const mockRequest = {
  provide: REQUEST,
  useValue: {
    headers: {},
    user: { id: 1, email: 'test@test.com' },
    ip: '127.0.0.1',
    method: 'GET',
    url: '/test',
  },
};

// Mock Dashboard Repository
export const mockDashboardRepository = {
  provide: getRepositoryToken(Dashboard),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    }),
  },
};

// Mock DashboardWidget Repository
export const mockDashboardWidgetRepository = {
  provide: getRepositoryToken(DashboardWidget),
  useValue: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock DashboardCacheService
export const mockDashboardCacheService = {
  provide: DashboardCacheService,
  useValue: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    clear: jest.fn(),
    invalidateUserDashboards: jest.fn(),
  },
};

// Mock DashboardWidgetService
export const mockDashboardWidgetService = {
  provide: DashboardWidgetService,
  useValue: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findByDashboardId: jest.fn().mockResolvedValue([]),
  },
};

// Mock EventEmitter2
export const mockEventEmitter = {
  provide: EventEmitter2,
  useValue: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
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
  mockDatabaseRepository,
  mockDatasetRepository,
  mockWidgetRepository,
  mockComponentRepository,
  mockConnectionService,
  mockHybridCacheService,
  mockBusinessMetricsService,
  mockDatabaseOptimizerFactory,
  mockRequest,
  mockDashboardRepository,
  mockDashboardWidgetRepository,
  mockDashboardCacheService,
  mockDashboardWidgetService,
  mockEventEmitter,
];
