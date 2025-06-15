import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueJob, JobStatus, JobType } from '../entities/queue-job.entity';

export interface ResourcePool {
  id: string;
  name: string;
  type: 'cpu' | 'memory' | 'database' | 'network';
  maxCapacity: number;
  currentUsage: number;
  reservedCapacity: number;
  availableCapacity: number;
  queuedJobs: string[];
}

export interface ResourceRequirement {
  cpu?: number; // CPU 코어 수 (0.1 = 10% of 1 core)
  memory?: number; // 메모리 MB
  database?: number; // DB 연결 수
  network?: number; // 네트워크 대역폭 (Mbps)
  duration?: number; // 예상 사용 시간 (ms)
}

export interface ResourceAllocation {
  jobId: string;
  allocatedResources: ResourceRequirement;
  allocatedAt: Date;
  estimatedReleaseAt: Date;
}

@Injectable()
export class JobResourceManagerService {
  private readonly logger = new Logger(JobResourceManagerService.name);

  // 리소스 풀들
  private resourcePools = new Map<string, ResourcePool>();

  // 현재 리소스 할당
  private resourceAllocations = new Map<string, ResourceAllocation>();

  // 작업 유형별 기본 리소스 요구사항
  private readonly defaultResourceRequirements: Record<JobType, ResourceRequirement> = {
    [JobType.QUERY_EXECUTION]: {
      cpu: 0.2, // 20% CPU
      memory: 128, // 128MB
      database: 1, // 1 DB 연결
      network: 10, // 10Mbps
    },
    [JobType.BULK_DATA_EXPORT]: {
      cpu: 0.5, // 50% CPU
      memory: 512, // 512MB
      database: 2, // 2 DB 연결
      network: 100, // 100Mbps
    },
    [JobType.DASHBOARD_GENERATION]: {
      cpu: 0.3, // 30% CPU
      memory: 256, // 256MB
      database: 3, // 3 DB 연결 (여러 위젯)
      network: 50, // 50Mbps
    },
    [JobType.DATA_MIGRATION]: {
      cpu: 0.8, // 80% CPU
      memory: 1024, // 1GB
      database: 4, // 4 DB 연결 (소스+타겟)
      network: 200, // 200Mbps
    },
    [JobType.CACHE_WARMUP]: {
      cpu: 0.4, // 40% CPU
      memory: 256, // 256MB
      database: 2, // 2 DB 연결
      network: 30, // 30Mbps
    },
    [JobType.REPORT_GENERATION]: {
      cpu: 0.6, // 60% CPU
      memory: 512, // 512MB
      database: 2, // 2 DB 연결
      network: 80, // 80Mbps
    },
  };

  constructor(
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,
  ) {
    this.initializeResourcePools();
    this.startResourceMonitoring();
  }

  /**
   * 리소스 풀 초기화
   */
  private initializeResourcePools(): void {
    // Lambda 환경을 고려한 리소스 풀 설정
    this.resourcePools.set('cpu', {
      id: 'cpu',
      name: 'CPU Pool',
      type: 'cpu',
      maxCapacity: 4.0, // 4 CPU 코어 (Lambda 최대)
      currentUsage: 0,
      reservedCapacity: 0,
      availableCapacity: 4.0,
      queuedJobs: [],
    });

    this.resourcePools.set('memory', {
      id: 'memory',
      name: 'Memory Pool',
      type: 'memory',
      maxCapacity: 3000, // 3GB (Lambda 최대)
      currentUsage: 0,
      reservedCapacity: 0,
      availableCapacity: 3000,
      queuedJobs: [],
    });

    this.resourcePools.set('database', {
      id: 'database',
      name: 'Database Connection Pool',
      type: 'database',
      maxCapacity: 20, // 최대 DB 연결 수
      currentUsage: 0,
      reservedCapacity: 0,
      availableCapacity: 20,
      queuedJobs: [],
    });

    this.resourcePools.set('network', {
      id: 'network',
      name: 'Network Bandwidth Pool',
      type: 'network',
      maxCapacity: 1000, // 1Gbps
      currentUsage: 0,
      reservedCapacity: 0,
      availableCapacity: 1000,
      queuedJobs: [],
    });

    this.logger.log('Resource pools initialized');
  }

  /**
   * 리소스 모니터링 시작
   */
  private startResourceMonitoring(): void {
    setInterval(async () => {
      try {
        await this.updateResourceUsage();
        await this.releaseExpiredAllocations();
        await this.checkResourceAvailability();
      } catch (error) {
        this.logger.error('Failed to monitor resources', error);
      }
    }, 30000); // 30초마다 모니터링
  }

  /**
   * 작업에 리소스 할당
   */
  async allocateResources(job: QueueJob): Promise<{
    success: boolean;
    allocation?: ResourceAllocation;
    waitTime?: number;
    reason?: string;
  }> {
    try {
      // 작업의 리소스 요구사항 계산
      const requirements = this.calculateResourceRequirements(job);

      // 리소스 가용성 확인
      const availabilityCheck = this.checkResourceAvailability(requirements);

      if (!availabilityCheck.available) {
        // 리소스 부족 시 대기 시간 추정
        const waitTime = this.estimateWaitTime(requirements);

        return {
          success: false,
          waitTime,
          reason: availabilityCheck.reason,
        };
      }

      // 리소스 할당
      const allocation = this.createResourceAllocation(job, requirements);
      this.resourceAllocations.set(job.id, allocation);

      // 리소스 풀 업데이트
      this.updateResourcePools(requirements, 'allocate');

      this.logger.debug(`Resources allocated for job ${job.id}:`, requirements);

      return {
        success: true,
        allocation,
      };
    } catch (error) {
      this.logger.error(`Failed to allocate resources for job ${job.id}`, error);
      return {
        success: false,
        reason: 'Resource allocation error',
      };
    }
  }

  /**
   * 작업 리소스 해제
   */
  async releaseResources(jobId: string): Promise<void> {
    try {
      const allocation = this.resourceAllocations.get(jobId);
      if (!allocation) {
        return;
      }

      // 리소스 풀에서 해제
      this.updateResourcePools(allocation.allocatedResources, 'release');

      // 할당 기록 제거
      this.resourceAllocations.delete(jobId);

      this.logger.debug(`Resources released for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to release resources for job ${jobId}`, error);
    }
  }

  /**
   * 리소스 사용률 조회
   */
  getResourceUsage(): {
    pools: ResourcePool[];
    allocations: ResourceAllocation[];
    totalAllocations: number;
    utilizationRates: Record<string, number>;
  } {
    const pools = Array.from(this.resourcePools.values());
    const allocations = Array.from(this.resourceAllocations.values());

    const utilizationRates: Record<string, number> = {};
    for (const pool of pools) {
      utilizationRates[pool.id] =
        pool.maxCapacity > 0 ? (pool.currentUsage / pool.maxCapacity) * 100 : 0;
    }

    return {
      pools,
      allocations,
      totalAllocations: allocations.length,
      utilizationRates,
    };
  }

  /**
   * 리소스 예약
   */
  async reserveResources(
    jobId: string,
    requirements: ResourceRequirement,
    duration: number,
  ): Promise<boolean> {
    try {
      // 예약 가능성 확인
      const canReserve = this.checkReservationCapacity(requirements);
      if (!canReserve) {
        return false;
      }

      // 예약 처리
      this.updateResourcePools(requirements, 'reserve');

      // 예약 해제 스케줄링
      setTimeout(() => {
        this.updateResourcePools(requirements, 'unreserve');
      }, duration);

      this.logger.debug(`Resources reserved for job ${jobId} for ${duration}ms`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to reserve resources for job ${jobId}`, error);
      return false;
    }
  }

  /**
   * 리소스 최적화 제안
   */
  getOptimizationRecommendations(): {
    recommendations: string[];
    potentialSavings: Record<string, number>;
    bottlenecks: string[];
  } {
    const recommendations: string[] = [];
    const potentialSavings: Record<string, number> = {};
    const bottlenecks: string[] = [];

    for (const [poolId, pool] of this.resourcePools) {
      const utilizationRate = (pool.currentUsage / pool.maxCapacity) * 100;

      if (utilizationRate > 90) {
        bottlenecks.push(`${pool.name}: ${utilizationRate.toFixed(1)}% 사용률`);
        recommendations.push(`${pool.name} 용량 증설을 고려하세요.`);
      } else if (utilizationRate < 20) {
        potentialSavings[poolId] = (pool.maxCapacity - pool.currentUsage) * 0.8;
        recommendations.push(`${pool.name} 용량을 줄여 비용을 절약할 수 있습니다.`);
      }
    }

    // 작업 유형별 최적화 제안
    const longRunningAllocations = Array.from(this.resourceAllocations.values()).filter(
      allocation => {
        const duration = Date.now() - allocation.allocatedAt.getTime();
        return duration > 30 * 60 * 1000; // 30분 이상
      },
    );

    if (longRunningAllocations.length > 0) {
      recommendations.push(
        `${longRunningAllocations.length}개의 장시간 실행 작업이 리소스를 점유하고 있습니다.`,
      );
    }

    return {
      recommendations,
      potentialSavings,
      bottlenecks,
    };
  }

  // Private helper methods

  /**
   * 작업의 리소스 요구사항 계산
   */
  private calculateResourceRequirements(job: QueueJob): ResourceRequirement {
    const baseRequirement = { ...this.defaultResourceRequirements[job.jobType] };

    // 작업 특성에 따른 조정
    const metadata = job.metadataParsed;

    // 데이터 크기에 따른 메모리 조정
    if (metadata.dataSize) {
      const dataSizeMB = metadata.dataSize / (1024 * 1024);
      baseRequirement.memory = Math.max(baseRequirement.memory || 128, dataSizeMB * 2);
    }

    // 예상 실행 시간에 따른 CPU 조정
    if (job.estimatedTimeMs && job.estimatedTimeMs > 300000) {
      // 5분 이상
      baseRequirement.cpu = (baseRequirement.cpu || 0.2) * 1.5;
    }

    // 재시도 작업은 리소스를 더 많이 할당
    if (job.retryCount > 0) {
      baseRequirement.cpu = (baseRequirement.cpu || 0.2) * 1.2;
      baseRequirement.memory = (baseRequirement.memory || 128) * 1.2;
    }

    baseRequirement.duration = job.estimatedTimeMs || 300000; // 기본 5분

    return baseRequirement;
  }

  /**
   * 리소스 가용성 확인
   */
  private checkResourceAvailability(requirements?: ResourceRequirement): {
    available: boolean;
    reason?: string;
  } {
    if (!requirements) {
      return { available: true };
    }

    for (const [resourceType, requiredAmount] of Object.entries(requirements)) {
      if (resourceType === 'duration') continue;

      const pool = this.resourcePools.get(resourceType);
      if (pool && requiredAmount > pool.availableCapacity) {
        return {
          available: false,
          reason: `Insufficient ${resourceType}: required ${requiredAmount}, available ${pool.availableCapacity}`,
        };
      }
    }

    return { available: true };
  }

  /**
   * 대기 시간 추정
   */
  private estimateWaitTime(requirements: ResourceRequirement): number {
    let maxWaitTime = 0;

    for (const [resourceType, requiredAmount] of Object.entries(requirements)) {
      if (resourceType === 'duration') continue;

      const pool = this.resourcePools.get(resourceType);
      if (pool && requiredAmount > pool.availableCapacity) {
        // 현재 할당된 작업들의 예상 완료 시간 기반으로 대기 시간 계산
        const allocations = Array.from(this.resourceAllocations.values()).filter(
          allocation => allocation.allocatedResources[resourceType as keyof ResourceRequirement],
        );

        const earliestRelease = Math.min(
          ...allocations.map(allocation => allocation.estimatedReleaseAt.getTime()),
        );

        const waitTime = Math.max(0, earliestRelease - Date.now());
        maxWaitTime = Math.max(maxWaitTime, waitTime);
      }
    }

    return maxWaitTime;
  }

  /**
   * 리소스 할당 생성
   */
  private createResourceAllocation(
    job: QueueJob,
    requirements: ResourceRequirement,
  ): ResourceAllocation {
    const now = new Date();
    const estimatedDuration = requirements.duration || job.estimatedTimeMs || 300000;

    return {
      jobId: job.id,
      allocatedResources: requirements,
      allocatedAt: now,
      estimatedReleaseAt: new Date(now.getTime() + estimatedDuration),
    };
  }

  /**
   * 리소스 풀 업데이트
   */
  private updateResourcePools(
    requirements: ResourceRequirement,
    operation: 'allocate' | 'release' | 'reserve' | 'unreserve',
  ): void {
    for (const [resourceType, amount] of Object.entries(requirements)) {
      if (resourceType === 'duration') continue;

      const pool = this.resourcePools.get(resourceType);
      if (!pool) continue;

      switch (operation) {
        case 'allocate':
          pool.currentUsage += amount;
          pool.availableCapacity -= amount;
          break;

        case 'release':
          pool.currentUsage = Math.max(0, pool.currentUsage - amount);
          pool.availableCapacity = Math.min(pool.maxCapacity, pool.availableCapacity + amount);
          break;

        case 'reserve':
          pool.reservedCapacity += amount;
          pool.availableCapacity -= amount;
          break;

        case 'unreserve':
          pool.reservedCapacity = Math.max(0, pool.reservedCapacity - amount);
          pool.availableCapacity = Math.min(pool.maxCapacity, pool.availableCapacity + amount);
          break;
      }

      // 값 보정 (음수 방지)
      pool.currentUsage = Math.max(0, pool.currentUsage);
      pool.reservedCapacity = Math.max(0, pool.reservedCapacity);
      pool.availableCapacity = Math.max(0, Math.min(pool.maxCapacity, pool.availableCapacity));
    }
  }

  /**
   * 리소스 사용량 업데이트
   */
  private async updateResourceUsage(): Promise<void> {
    try {
      // 실행 중인 작업 수 조회
      const runningJobs = await this.jobRepository.count({
        where: { status: JobStatus.RUNNING },
      });

      // CPU 풀의 현재 사용량 업데이트 (실제로는 시스템 메트릭에서)
      const cpuPool = this.resourcePools.get('cpu');
      if (cpuPool) {
        // 실행 중인 작업 수에 기반한 추정
        const estimatedCpuUsage = runningJobs * 0.3; // 작업당 평균 30% CPU
        cpuPool.currentUsage = Math.min(estimatedCpuUsage, cpuPool.maxCapacity);
        cpuPool.availableCapacity =
          cpuPool.maxCapacity - cpuPool.currentUsage - cpuPool.reservedCapacity;
      }
    } catch (error) {
      this.logger.error('Failed to update resource usage', error);
    }
  }

  /**
   * 만료된 할당 해제
   */
  private async releaseExpiredAllocations(): Promise<void> {
    try {
      const now = Date.now();
      const expiredAllocations: string[] = [];

      for (const [jobId, allocation] of this.resourceAllocations) {
        if (allocation.estimatedReleaseAt.getTime() < now) {
          expiredAllocations.push(jobId);
        }
      }

      for (const jobId of expiredAllocations) {
        await this.releaseResources(jobId);
        this.logger.debug(`Released expired allocation for job ${jobId}`);
      }
    } catch (error) {
      this.logger.error('Failed to release expired allocations', error);
    }
  }

  /**
   * 예약 용량 확인
   */
  private checkReservationCapacity(requirements: ResourceRequirement): boolean {
    for (const [resourceType, requiredAmount] of Object.entries(requirements)) {
      if (resourceType === 'duration') continue;

      const pool = this.resourcePools.get(resourceType);
      if (pool && requiredAmount > pool.availableCapacity) {
        return false;
      }
    }
    return true;
  }
}
