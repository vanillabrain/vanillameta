import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { WidgetService } from '../../src/widget/widget.service';
import { DatasetService } from '../../src/dataset/dataset.service';
import { DatabaseService } from '../../src/database/database.service';
import { UserService } from '../../src/user/user.service';
import { getTestMysqlModule } from '../util/get-test-mysql.module';

describe('Database Index Performance Tests', () => {
  let module: TestingModule;
  let dashboardService: DashboardService;
  let widgetService: WidgetService;
  let datasetService: DatasetService;
  let databaseService: DatabaseService;
  let userService: UserService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [getTestMysqlModule()],
      providers: [
        DashboardService,
        WidgetService,
        DatasetService,
        DatabaseService,
        UserService,
      ],
    }).compile();

    dashboardService = module.get<DashboardService>(DashboardService);
    widgetService = module.get<WidgetService>(WidgetService);
    datasetService = module.get<DatasetService>(DatasetService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    userService = module.get<UserService>(UserService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Dashboard Query Performance', () => {
    it('should improve performance for dashboard list queries', async () => {
      const userId = 1;
      
      // Measure query performance
      const startTime = Date.now();
      await dashboardService.findAll(userId);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      console.log(`Dashboard list query time: ${executionTime}ms`);
      
      // Performance should be under 100ms with indexes
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('Widget Query Performance', () => {
    it('should improve performance for widget list queries with joins', async () => {
      const startTime = Date.now();
      await widgetService.findAll();
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      console.log(`Widget list query time: ${executionTime}ms`);
      
      // Performance should be under 150ms with indexes
      expect(executionTime).toBeLessThan(150);
    });
  });

  describe('Dataset Query Performance', () => {
    it('should improve performance for dataset queries by database ID', async () => {
      const databaseId = 1;
      
      const startTime = Date.now();
      await databaseService.findOne(databaseId);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      console.log(`Dataset by database ID query time: ${executionTime}ms`);
      
      // Performance should be under 100ms with indexes
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('User Mapping Query Performance', () => {
    it('should improve performance for user dashboard queries', async () => {
      const userId = 1;
      
      const startTime = Date.now();
      await userService.findDashboardId(userId);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      console.log(`User dashboard mapping query time: ${executionTime}ms`);
      
      // Performance should be under 50ms with indexes
      expect(executionTime).toBeLessThan(50);
    });
  });
});

// 성능 벤치마크 유틸리티
export class PerformanceBenchmark {
  private results: Map<string, number[]> = new Map();

  async measure(name: string, fn: () => Promise<any>): Promise<void> {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await fn();
      const end = Date.now();
      times.push(end - start);
    }

    this.results.set(name, times);
  }

  getStats(name: string): { avg: number; min: number; max: number; median: number } {
    const times = this.results.get(name) || [];
    if (times.length === 0) {
      return { avg: 0, min: 0, max: 0, median: 0 };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];

    return { avg, min, max, median };
  }

  printReport(): void {
    console.log('\n=== Performance Benchmark Report ===\n');
    
    for (const [name, times] of this.results) {
      const stats = this.getStats(name);
      console.log(`${name}:`);
      console.log(`  Average: ${stats.avg.toFixed(2)}ms`);
      console.log(`  Min: ${stats.min}ms`);
      console.log(`  Max: ${stats.max}ms`);
      console.log(`  Median: ${stats.median}ms`);
      console.log('');
    }
  }
}