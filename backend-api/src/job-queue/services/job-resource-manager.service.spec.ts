import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobResourceManagerService,
  ResourcePool,
  ResourceRequirement,
  ResourceAllocation,
} from './job-resource-manager.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';

describe('JobResourceManagerService', () => {
  let service: JobResourceManagerService;
  let jobRepository: jest.Mocked<Repository<QueueJob>>;

  const mockJob: QueueJob = {
    id: 'job-123',
    jobType: JobType.QUERY_EXECUTION,
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
    userId: 'user-123',
    jobData: JSON.stringify({ query: 'SELECT * FROM users' }),
    result: null,
    errorMessage: null,
    errorStack: null,
    retryCount: 0,
    maxRetries: 3,
    progress: 0,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    executionTimeMs: null,
    estimatedTimeMs: 30000,
    workerId: null,
    metadata: JSON.stringify({ size: 'medium', dataSize: 1024000 }),
    correlationId: null,
    requiresNotification: false,
    notificationEmail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isCompleted: false,
    isFailed: false,
    isRunning: false,
    canRetry: true,
    jobDataParsed: { query: 'SELECT * FROM users' },
    resultParsed: null,
    metadataParsed: { size: 'medium', dataSize: 1024000 },
  };

  beforeEach(async () => {
    const mockJobRepository = {
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobResourceManagerService,
        {
          provide: getRepositoryToken(QueueJob),
          useValue: mockJobRepository,
        },
      ],
    }).compile();

    service = module.get<JobResourceManagerService>(JobResourceManagerService);
    jobRepository = module.get(getRepositoryToken(QueueJob));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('allocateResources', () => {
    it('should allocate resources for standard job', async () => {
      // Arrange
      const job = { ...mockJob, jobType: JobType.QUERY_EXECUTION };

      // Act
      const result = await service.allocateResources(job);

      // Assert
      expect(result.success).toBe(true);
      expect(result.allocation).toBeDefined();
      expect(result.allocation?.jobId).toBe(job.id);
      expect(result.allocation?.allocatedResources).toMatchObject({
        cpu: expect.any(Number),
        memory: expect.any(Number),
        database: expect.any(Number),
        network: expect.any(Number),
      });
    });

    it('should fail allocation when resources are insufficient', async () => {
      // Arrange
      const bigJob = {
        ...mockJob,
        jobType: JobType.DATA_MIGRATION,
        metadata: JSON.stringify({ dataSize: 10 * 1024 * 1024 * 1024 }), // 10GB
        metadataParsed: { dataSize: 10 * 1024 * 1024 * 1024 },
      };

      // Pre-allocate resources to cause shortage
      await service.allocateResources({ ...mockJob, id: 'job-1' });
      await service.allocateResources({ ...mockJob, id: 'job-2' });
      await service.allocateResources({ ...mockJob, id: 'job-3' });

      // Act
      const result = await service.allocateResources(bigJob);

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Insufficient');
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it('should calculate correct resource requirements for different job types', async () => {
      // Arrange
      const queryJob = { ...mockJob, jobType: JobType.QUERY_EXECUTION };
      const bulkExportJob = { ...mockJob, jobType: JobType.BULK_DATA_EXPORT };
      const migrationJob = { ...mockJob, jobType: JobType.DATA_MIGRATION };

      // Act
      const queryResult = await service.allocateResources(queryJob);
      const bulkExportResult = await service.allocateResources(bulkExportJob);
      const migrationResult = await service.allocateResources(migrationJob);

      // Assert
      expect(queryResult.success).toBe(true);
      expect(bulkExportResult.success).toBe(true);
      expect(migrationResult.success).toBe(true);

      // Migration jobs should require more resources than query jobs
      expect(migrationResult.allocation?.allocatedResources.cpu).toBeGreaterThan(
        queryResult.allocation?.allocatedResources.cpu || 0,
      );
      expect(migrationResult.allocation?.allocatedResources.memory).toBeGreaterThan(
        queryResult.allocation?.allocatedResources.memory || 0,
      );
    });

    it('should adjust resource requirements based on job metadata', async () => {
      // Arrange
      const smallJob = {
        ...mockJob,
        metadata: JSON.stringify({ dataSize: 1024 }), // 1KB
        metadataParsed: { dataSize: 1024 },
      };
      const largeJob = {
        ...mockJob,
        metadata: JSON.stringify({ dataSize: 10 * 1024 * 1024 }), // 10MB
        metadataParsed: { dataSize: 10 * 1024 * 1024 },
      };

      // Act
      const smallResult = await service.allocateResources(smallJob);
      const largeResult = await service.allocateResources(largeJob);

      // Assert
      expect(smallResult.success).toBe(true);
      expect(largeResult.success).toBe(true);
      expect(largeResult.allocation?.allocatedResources.memory).toBeGreaterThan(
        smallResult.allocation?.allocatedResources.memory || 0,
      );
    });

    it('should give priority to retry jobs', async () => {
      // Arrange
      const normalJob = { ...mockJob, retryCount: 0 };
      const retryJob = { ...mockJob, retryCount: 2 };

      // Act
      const normalResult = await service.allocateResources(normalJob);
      const retryResult = await service.allocateResources(retryJob);

      // Assert
      expect(normalResult.success).toBe(true);
      expect(retryResult.success).toBe(true);
      // Retry jobs should get slightly more resources
      expect(retryResult.allocation?.allocatedResources.cpu).toBeGreaterThan(
        normalResult.allocation?.allocatedResources.cpu || 0,
      );
    });
  });

  describe('releaseResources', () => {
    it('should release allocated resources', async () => {
      // Arrange
      const job = { ...mockJob };
      const allocationResult = await service.allocateResources(job);
      expect(allocationResult.success).toBe(true);

      const initialUsage = service.getResourceUsage();

      // Act
      await service.releaseResources(job.id);

      // Assert
      const finalUsage = service.getResourceUsage();
      expect(finalUsage.totalAllocations).toBeLessThan(initialUsage.totalAllocations);
    });

    it('should handle release of non-existent allocation', async () => {
      // Act & Assert
      await expect(service.releaseResources('non-existent-job')).resolves.not.toThrow();
    });
  });

  describe('getResourceUsage', () => {
    it('should return current resource usage', () => {
      // Act
      const usage = service.getResourceUsage();

      // Assert
      expect(usage).toHaveProperty('pools');
      expect(usage).toHaveProperty('allocations');
      expect(usage).toHaveProperty('totalAllocations');
      expect(usage).toHaveProperty('utilizationRates');

      expect(Array.isArray(usage.pools)).toBe(true);
      expect(Array.isArray(usage.allocations)).toBe(true);
      expect(typeof usage.totalAllocations).toBe('number');
      expect(typeof usage.utilizationRates).toBe('object');

      // Should have standard resource pools
      const poolIds = usage.pools.map(pool => pool.id);
      expect(poolIds).toContain('cpu');
      expect(poolIds).toContain('memory');
      expect(poolIds).toContain('database');
      expect(poolIds).toContain('network');
    });

    it('should calculate utilization rates correctly', async () => {
      // Arrange - Allocate some resources
      await service.allocateResources({ ...mockJob, id: 'job-1' });
      await service.allocateResources({ ...mockJob, id: 'job-2' });

      // Act
      const usage = service.getResourceUsage();

      // Assert
      Object.values(usage.utilizationRates).forEach(rate => {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('reserveResources', () => {
    it('should reserve resources for future use', async () => {
      // Arrange
      const requirements: ResourceRequirement = {
        cpu: 0.5,
        memory: 256,
        database: 2,
        network: 50,
      };
      const duration = 10000; // 10 seconds

      // Act
      const result = await service.reserveResources('future-job-123', requirements, duration);

      // Assert
      expect(result).toBe(true);

      // Check that resources are marked as reserved
      const usage = service.getResourceUsage();
      const cpuPool = usage.pools.find(pool => pool.id === 'cpu');
      expect(cpuPool?.reservedCapacity).toBeGreaterThan(0);
    });

    it('should fail reservation when insufficient capacity', async () => {
      // Arrange - Try to reserve more than available
      const hugeRequirements: ResourceRequirement = {
        cpu: 10, // More than max capacity
        memory: 5000,
        database: 100,
        network: 2000,
      };

      // Act
      const result = await service.reserveResources('big-job', hugeRequirements, 5000);

      // Assert
      expect(result).toBe(false);
    });

    it('should automatically release reservations after duration', async done => {
      // Arrange
      const requirements: ResourceRequirement = {
        cpu: 0.3,
        memory: 128,
      };
      const duration = 100; // 100ms

      // Act
      const result = await service.reserveResources('temp-job', requirements, duration);
      expect(result).toBe(true);

      const initialUsage = service.getResourceUsage();
      const cpuPool = initialUsage.pools.find(pool => pool.id === 'cpu');
      expect(cpuPool?.reservedCapacity).toBeGreaterThan(0);

      // Assert - Check after duration
      setTimeout(() => {
        const finalUsage = service.getResourceUsage();
        const finalCpuPool = finalUsage.pools.find(pool => pool.id === 'cpu');
        expect(finalCpuPool?.reservedCapacity).toBeLessThan(cpuPool?.reservedCapacity || 0);
        done();
      }, 150);
    });
  });

  describe('getOptimizationRecommendations', () => {
    it('should provide optimization recommendations', () => {
      // Act
      const recommendations = service.getOptimizationRecommendations();

      // Assert
      expect(recommendations).toHaveProperty('recommendations');
      expect(recommendations).toHaveProperty('potentialSavings');
      expect(recommendations).toHaveProperty('bottlenecks');

      expect(Array.isArray(recommendations.recommendations)).toBe(true);
      expect(Array.isArray(recommendations.bottlenecks)).toBe(true);
      expect(typeof recommendations.potentialSavings).toBe('object');
    });

    it('should detect bottlenecks with high utilization', async () => {
      // Arrange - Create high utilization scenario
      for (let i = 0; i < 10; i++) {
        await service.allocateResources({ ...mockJob, id: `job-${i}` });
      }

      // Act
      const recommendations = service.getOptimizationRecommendations();

      // Assert
      expect(recommendations.bottlenecks.length).toBeGreaterThan(0);
      expect(recommendations.recommendations).toContain(
        expect.stringContaining('용량 증설을 고려하세요'),
      );
    });

    it('should suggest capacity reduction for underutilized resources', () => {
      // Arrange - No allocations (underutilized)

      // Act
      const recommendations = service.getOptimizationRecommendations();

      // Assert
      expect(recommendations.recommendations).toContain(
        expect.stringContaining('용량을 줄여 비용을 절약할 수 있습니다'),
      );
    });

    it('should identify long-running allocations', async () => {
      // Arrange - Create a long-running allocation
      const job = { ...mockJob, estimatedTimeMs: 60000 }; // 1 minute estimate
      await service.allocateResources(job);

      // Simulate time passage by manually setting allocation time
      const usage = service.getResourceUsage();
      if (usage.allocations.length > 0) {
        const allocation = usage.allocations[0];
        // Mock that this allocation has been running for 35 minutes
        allocation.allocatedAt = new Date(Date.now() - 35 * 60 * 1000);
      }

      // Act
      const recommendations = service.getOptimizationRecommendations();

      // Assert
      expect(recommendations.recommendations).toContain(
        expect.stringContaining('장시간 실행 작업이 리소스를 점유하고 있습니다'),
      );
    });
  });

  describe('resource monitoring', () => {
    it('should update resource usage periodically', async () => {
      // Arrange
      jobRepository.count.mockResolvedValue(3); // 3 running jobs

      // Act - Trigger manual update
      await service['updateResourceUsage']();

      // Assert
      const usage = service.getResourceUsage();
      const cpuPool = usage.pools.find(pool => pool.id === 'cpu');
      expect(cpuPool?.currentUsage).toBeGreaterThan(0);
    });

    it('should release expired allocations', async () => {
      // Arrange - Create allocation with very short duration
      const job = { ...mockJob, estimatedTimeMs: 1 }; // 1ms estimate
      await service.allocateResources(job);

      const initialUsage = service.getResourceUsage();
      expect(initialUsage.totalAllocations).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act - Trigger cleanup
      await service['releaseExpiredAllocations']();

      // Assert
      const finalUsage = service.getResourceUsage();
      expect(finalUsage.totalAllocations).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle allocation errors gracefully', async () => {
      // Arrange - Create a malformed job
      const malformedJob = { ...mockJob, jobType: null } as any;

      // Act & Assert
      const result = await service.allocateResources(malformedJob);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('error');
    });

    it('should handle database errors in monitoring', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      jobRepository.count.mockRejectedValue(error);

      // Act & Assert
      await expect(service['updateResourceUsage']()).resolves.not.toThrow();
    });

    it('should handle resource release errors', async () => {
      // Act & Assert
      await expect(service.releaseResources('invalid-job-id')).resolves.not.toThrow();
    });
  });

  describe('resource pool management', () => {
    it('should initialize resource pools correctly', () => {
      // Act
      const usage = service.getResourceUsage();

      // Assert
      expect(usage.pools).toHaveLength(4); // cpu, memory, database, network

      usage.pools.forEach(pool => {
        expect(pool).toHaveProperty('id');
        expect(pool).toHaveProperty('name');
        expect(pool).toHaveProperty('type');
        expect(pool).toHaveProperty('maxCapacity');
        expect(pool).toHaveProperty('currentUsage');
        expect(pool).toHaveProperty('reservedCapacity');
        expect(pool).toHaveProperty('availableCapacity');
        expect(pool).toHaveProperty('queuedJobs');

        expect(pool.maxCapacity).toBeGreaterThan(0);
        expect(pool.currentUsage).toBeGreaterThanOrEqual(0);
        expect(pool.reservedCapacity).toBeGreaterThanOrEqual(0);
        expect(pool.availableCapacity).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(pool.queuedJobs)).toBe(true);
      });
    });

    it('should maintain pool invariants', async () => {
      // Arrange - Allocate some resources
      await service.allocateResources({ ...mockJob, id: 'test-job' });

      // Act
      const usage = service.getResourceUsage();

      // Assert - Verify pool invariants
      usage.pools.forEach(pool => {
        expect(pool.currentUsage + pool.reservedCapacity + pool.availableCapacity).toBeCloseTo(
          pool.maxCapacity,
          2,
        );
        expect(pool.currentUsage).toBeLessThanOrEqual(pool.maxCapacity);
        expect(pool.reservedCapacity).toBeLessThanOrEqual(pool.maxCapacity);
        expect(pool.availableCapacity).toBeLessThanOrEqual(pool.maxCapacity);
      });
    });
  });

  describe('Lambda environment optimization', () => {
    it('should configure pools for Lambda constraints', () => {
      // Act
      const usage = service.getResourceUsage();

      // Assert - Verify Lambda-appropriate limits
      const cpuPool = usage.pools.find(pool => pool.id === 'cpu');
      const memoryPool = usage.pools.find(pool => pool.id === 'memory');

      expect(cpuPool?.maxCapacity).toBeLessThanOrEqual(4.0); // Lambda max CPU
      expect(memoryPool?.maxCapacity).toBeLessThanOrEqual(3000); // Lambda max memory (MB)
    });

    it('should optimize resource allocation for serverless', async () => {
      // Arrange
      const job = { ...mockJob, jobType: JobType.QUERY_EXECUTION };

      // Act
      const result = await service.allocateResources(job);

      // Assert
      expect(result.success).toBe(true);

      // Verify allocations are reasonable for Lambda
      const allocation = result.allocation;
      expect(allocation?.allocatedResources.cpu).toBeLessThanOrEqual(1.0);
      expect(allocation?.allocatedResources.memory).toBeLessThanOrEqual(1000);
    });
  });
});
