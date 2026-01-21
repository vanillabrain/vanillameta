# T03: 작업 큐 관리 시스템 구현

## 📋 작업 개요
- **작업 ID**: T03_S05
- **작업명**: 작업 큐 관리 시스템 구현
- **소요 시간**: 4일
- **담당 팀**: Backend Team

## 🎯 작업 목표
비동기 작업 처리를 위한 강력하고 확장 가능한 작업 큐 시스템을 구축합니다.

## 📝 상세 작업 내용

### 1. 작업 큐 아키텍처

#### 1.1 작업 정의
```typescript
// 작업 인터페이스
interface Job {
  id: string;
  queue: QueueName;
  type: JobType;
  priority: JobPriority;
  payload: any;
  options: JobOptions;
  status: JobStatus;
  attempts: number;
  result?: any;
  error?: Error;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
}

// 작업 옵션
interface JobOptions {
  delay?: number;
  attempts?: number;
  backoff?: BackoffOptions;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
  timeout?: number;
}

// 우선순위
enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4
}
```

### 2. Bull Queue 통합

#### 2.1 큐 관리자
```typescript
// src/modules/queue/services/queue-manager.service.ts
@Injectable()
export class QueueManagerService {
  private queues: Map<string, Queue> = new Map();
  
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService
  ) {
    this.initializeQueues();
  }
  
  private initializeQueues(): void {
    // 각 큐 타입별 초기화
    const queueConfigs = [
      { name: 'query-execution', concurrency: 10 },
      { name: 'data-export', concurrency: 5 },
      { name: 'report-generation', concurrency: 3 },
      { name: 'cache-refresh', concurrency: 20 },
      { name: 'notification', concurrency: 50 }
    ];
    
    queueConfigs.forEach(config => {
      this.createQueue(config.name, config.concurrency);
    });
  }
  
  createQueue(name: string, concurrency: number): Queue {
    const queue = new Queue(name, {
      redis: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });
    
    this.queues.set(name, queue);
    return queue;
  }
}
```

#### 2.2 작업 프로세서
```typescript
// 추상 작업 프로세서
export abstract class BaseJobProcessor<T> {
  abstract readonly queueName: string;
  abstract readonly concurrency: number;
  
  abstract async process(job: Job<T>): Promise<any>;
  abstract async onCompleted(job: Job<T>, result: any): Promise<void>;
  abstract async onFailed(job: Job<T>, error: Error): Promise<void>;
  
  protected async updateProgress(job: Job<T>, progress: number): Promise<void> {
    await job.progress(progress);
  }
}

// 쿼리 실행 프로세서
@Processor('query-execution')
export class QueryExecutionProcessor extends BaseJobProcessor<QueryJobPayload> {
  readonly queueName = 'query-execution';
  readonly concurrency = 10;
  
  constructor(
    private readonly queryService: QueryService,
    private readonly cacheService: CacheService
  ) {
    super();
  }
  
  async process(job: Job<QueryJobPayload>): Promise<QueryResult> {
    const { queryId, dataSourceId, query, options } = job.data;
    
    // 진행률 업데이트
    await this.updateProgress(job, 10);
    
    // 캐시 확인
    const cached = await this.cacheService.get(queryId);
    if (cached) return cached;
    
    await this.updateProgress(job, 30);
    
    // 쿼리 실행
    const result = await this.queryService.execute(
      dataSourceId,
      query,
      options
    );
    
    await this.updateProgress(job, 90);
    
    // 결과 캐싱
    await this.cacheService.set(queryId, result);
    
    await this.updateProgress(job, 100);
    
    return result;
  }
}
```

### 3. 작업 스케줄링

#### 3.1 스케줄러 서비스
```typescript
// src/modules/queue/services/job-scheduler.service.ts
@Injectable()
export class JobSchedulerService {
  constructor(
    private readonly queueManager: QueueManagerService,
    private readonly jobRepository: JobRepository
  ) {}
  
  async scheduleJob(
    queueName: string,
    jobData: any,
    options: ScheduleOptions
  ): Promise<Job> {
    const queue = this.queueManager.getQueue(queueName);
    
    let job: Job;
    if (options.cron) {
      // 반복 작업
      job = await queue.add(jobData, {
        repeat: {
          cron: options.cron,
          tz: options.timezone || 'UTC'
        }
      });
    } else if (options.delay) {
      // 지연 작업
      job = await queue.add(jobData, {
        delay: options.delay
      });
    } else {
      // 즉시 실행
      job = await queue.add(jobData);
    }
    
    // DB에 작업 정보 저장
    await this.jobRepository.save({
      jobId: job.id,
      queue: queueName,
      data: jobData,
      options,
      status: 'scheduled'
    });
    
    return job;
  }
  
  async cancelJob(jobId: string): Promise<void> {
    const jobInfo = await this.jobRepository.findById(jobId);
    const queue = this.queueManager.getQueue(jobInfo.queue);
    
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
    
    await this.jobRepository.updateStatus(jobId, 'cancelled');
  }
}
```

### 4. 작업 모니터링

#### 4.1 큐 모니터링 서비스
```typescript
// src/modules/queue/services/queue-monitor.service.ts
@Injectable()
export class QueueMonitorService {
  async getQueueStatus(queueName: string): Promise<QueueStatus> {
    const queue = this.queueManager.getQueue(queueName);
    
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused()
    ]);
    
    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      health: this.calculateHealth({ waiting, active, failed })
    };
  }
  
  async getJobDetails(queueName: string, jobId: string): Promise<JobDetails> {
    const queue = this.queueManager.getQueue(queueName);
    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    
    const logs = await queue.getJobLogs(jobId);
    
    return {
      id: job.id,
      data: job.data,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      logs,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : null
    };
  }
}
```

#### 4.2 Bull Board 통합
```typescript
// src/modules/queue/queue.module.ts
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      auth: {
        username: process.env.BULL_BOARD_USER,
        password: process.env.BULL_BOARD_PASS,
      },
    }),
    BullBoardModule.forFeature({
      name: 'query-execution',
      adapter: BullAdapter,
    }),
    // 다른 큐들도 추가
  ],
})
export class QueueModule {}
```

### 5. 에러 처리 및 데드레터 큐

#### 5.1 에러 핸들러
```typescript
export class JobErrorHandler {
  private readonly deadLetterQueue: Queue;
  
  constructor(queueManager: QueueManagerService) {
    this.deadLetterQueue = queueManager.createQueue('dead-letter', 1);
  }
  
  async handleJobError(
    job: Job,
    error: Error,
    options: ErrorHandlingOptions
  ): Promise<void> {
    // 에러 로깅
    logger.error(`Job ${job.id} failed: ${error.message}`, {
      jobId: job.id,
      queue: job.queue.name,
      error: error.stack,
      attempts: job.attemptsMade
    });
    
    // 재시도 한계 도달 시
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      // 데드레터 큐로 이동
      await this.moveToDeadLetter(job, error);
      
      // 알림 발송
      if (options.sendAlert) {
        await this.sendAlert(job, error);
      }
    }
  }
  
  private async moveToDeadLetter(job: Job, error: Error): Promise<void> {
    await this.deadLetterQueue.add('failed-job', {
      originalJob: {
        id: job.id,
        queue: job.queue.name,
        data: job.data,
        error: error.message,
        stacktrace: error.stack,
        failedAt: new Date()
      }
    });
  }
}
```

### 6. 작업 우선순위 및 동시성 제어

#### 6.1 우선순위 큐
```typescript
export class PriorityQueueManager {
  createPriorityQueue(name: string): Queue {
    return new Queue(name, {
      defaultJobOptions: {
        priority: JobPriority.NORMAL
      }
    });
  }
  
  async addPriorityJob(
    queue: Queue,
    data: any,
    priority: JobPriority
  ): Promise<Job> {
    return queue.add(data, {
      priority,
      // 높은 우선순위 작업은 재시도 횟수 증가
      attempts: priority === JobPriority.CRITICAL ? 5 : 3
    });
  }
}
```

#### 6.2 동시성 제어
```typescript
export class ConcurrencyController {
  private readonly activeLimits = new Map<string, number>();
  
  async acquireSlot(resource: string, maxConcurrency: number): Promise<boolean> {
    const current = this.activeLimits.get(resource) || 0;
    
    if (current >= maxConcurrency) {
      return false;
    }
    
    this.activeLimits.set(resource, current + 1);
    return true;
  }
  
  releaseSlot(resource: string): void {
    const current = this.activeLimits.get(resource) || 0;
    this.activeLimits.set(resource, Math.max(0, current - 1));
  }
}
```

## 🔧 기술 스택
- Bull Queue
- Redis
- Bull Board
- Socket.io (실시간 업데이트)

## ✅ 완료 조건
- [ ] 5개 이상의 큐 타입 지원
- [ ] 작업 우선순위 처리
- [ ] 작업 스케줄링 (cron, delay)
- [ ] 실시간 모니터링 대시보드
- [ ] 데드레터 큐 처리
- [ ] 작업 재시도 메커니즘
- [ ] 동시성 제어
- [ ] 작업 진행률 추적
- [ ] 클러스터 모드 지원

## 📊 성능 목표
- 작업 처리 지연: < 100ms
- 동시 처리 작업: > 1000개
- 큐 처리량: > 10,000 jobs/min
- 시스템 가용성: 99.9%

## 🧪 테스트 계획
1. 단위 테스트
   - 큐 관리자
   - 작업 프로세서
   - 에러 핸들러

2. 통합 테스트
   - 전체 작업 생명주기
   - 우선순위 처리
   - 재시도 메커니즘

3. 부하 테스트
   - 대량 작업 처리
   - 동시성 한계 테스트
   - 메모리 사용량 모니터링

## 📚 참고 자료
- [Bull Queue 공식 문서](https://github.com/OptimalBits/bull)
- [Message Queue Patterns](https://www.enterpriseintegrationpatterns.com/patterns/messaging/)
- [Bull Board](https://github.com/felixmosh/bull-board)