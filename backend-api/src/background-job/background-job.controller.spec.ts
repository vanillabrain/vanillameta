import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LegacyOperationsGuard } from '../auth/guards/legacy-operations.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { BackgroundJobController } from './background-job.controller';
import { BackgroundJobService } from './background-job.service';
import { CreateBackgroundJobDto } from './dto/create-background-job.dto';
import { JobType } from './entities/background-job.entity';

describe('BackgroundJobController', () => {
  let controller: BackgroundJobController;
  let service: BackgroundJobService;

  const mockBackgroundJobService = {
    createJob: jest.fn(),
    getJobsByUser: jest.fn(),
    getJobById: jest.fn(),
    getJobResult: jest.fn(),
    getJobResultData: jest.fn(),
    cancelJob: jest.fn(),
  };

  const mockUser = {
    accessKeyData: { id: 7, userId: 'user123', authVersion: 3 },
    userId: 'user123',
    userEmail: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackgroundJobController],
      providers: [
        {
          provide: BackgroundJobService,
          useValue: mockBackgroundJobService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LegacyOperationsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BackgroundJobController>(BackgroundJobController);
    service = module.get<BackgroundJobService>(BackgroundJobService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('serves /v1/background-jobs and rejects the duplicate v1 path', async () => {
    const fixture = await Test.createTestingModule({
      controllers: [BackgroundJobController],
      providers: [{ provide: BackgroundJobService, useValue: mockBackgroundJobService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = fixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use((req: any, _res: any, next: () => void) => {
      req.user = mockUser;
      next();
    });
    mockBackgroundJobService.getJobsByUser.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    try {
      await app.listen(0, '127.0.0.1');
      await request(app.getHttpServer()).get('/v1/background-jobs').expect(200);
      await request(app.getHttpServer()).get('/v1/v1/background-jobs').expect(404);
      expect(mockBackgroundJobService.getJobsByUser).toHaveBeenCalledWith(
        mockUser.accessKeyData,
        1,
        20,
      );
    } finally {
      await app.close();
    }
  });

  describe('createJob', () => {
    it('should create a new background job', async () => {
      const createJobDto: CreateBackgroundJobDto = {
        jobType: JobType.QUERY_EXECUTION,
        title: 'Test Query Job',
        description: 'Test description',
        datasetId: 'dataset123',
        databaseId: 'database123',
        query: 'SELECT * FROM users',
      };

      const expectedResponse = {
        id: 'job123',
        jobType: JobType.QUERY_EXECUTION,
        status: 'pending',
        title: 'Test Query Job',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBackgroundJobService.createJob.mockResolvedValueOnce(expectedResponse);

      const result = await controller.createJob(mockUser, createJobDto);

      expect(result).toBe(expectedResponse);
      expect(mockBackgroundJobService.createJob).toHaveBeenCalledWith(
        mockUser.accessKeyData,
        createJobDto,
      );
    });
  });

  describe('getJobs', () => {
    it('should return a list of user jobs', async () => {
      const expectedResponse = {
        items: [
          {
            id: 'job1',
            jobType: JobType.QUERY_EXECUTION,
            status: 'completed',
            title: 'Job 1',
            progress: 100,
          },
          {
            id: 'job2',
            jobType: JobType.QUERY_EXECUTION,
            status: 'processing',
            title: 'Job 2',
            progress: 50,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      mockBackgroundJobService.getJobsByUser.mockResolvedValueOnce(expectedResponse);

      const result = await controller.getJobs(mockUser, 1, 20);

      expect(result).toBe(expectedResponse);
      expect(mockBackgroundJobService.getJobsByUser).toHaveBeenCalledWith(
        mockUser.accessKeyData,
        1,
        20,
      );
    });
  });

  describe('getJob', () => {
    it('should return a specific job', async () => {
      const jobId = 'job123';
      const expectedResponse = {
        id: jobId,
        jobType: JobType.QUERY_EXECUTION,
        status: 'completed',
        title: 'Test Job',
        progress: 100,
        hasResult: true,
        resultSizeBytes: 1000,
        rowCount: 10,
      };

      mockBackgroundJobService.getJobById.mockResolvedValueOnce(expectedResponse);

      const result = await controller.getJob(mockUser, jobId);

      expect(result).toBe(expectedResponse);
      expect(mockBackgroundJobService.getJobById).toHaveBeenCalledWith(
        jobId,
        mockUser.accessKeyData,
      );
    });
  });

  describe('getJobResult', () => {
    it('should return job result metadata', async () => {
      const jobId = 'job123';
      const expectedResponse = {
        id: 'result123',
        backgroundJobId: jobId,
        storageType: 'database',
        resultSizeBytes: 1000,
        rowCount: 10,
        createdAt: new Date(),
      };

      mockBackgroundJobService.getJobResult.mockResolvedValueOnce(expectedResponse);

      const result = await controller.getJobResult(mockUser, jobId);

      expect(result).toBe(expectedResponse);
      expect(mockBackgroundJobService.getJobResult).toHaveBeenCalledWith(
        jobId,
        mockUser.accessKeyData,
      );
    });
  });

  describe('getJobResultData', () => {
    it('should return job result data', async () => {
      const jobId = 'job123';
      const expectedData = {
        data: [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' },
        ],
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'string' },
        ],
      };

      mockBackgroundJobService.getJobResultData.mockResolvedValueOnce(expectedData);

      const result = await controller.getJobResultData(mockUser, jobId);

      expect(result).toBe(expectedData);
      expect(mockBackgroundJobService.getJobResultData).toHaveBeenCalledWith(
        jobId,
        mockUser.accessKeyData,
      );
    });
  });

  describe('cancelJob', () => {
    it('should cancel a job', async () => {
      const jobId = 'job123';

      mockBackgroundJobService.cancelJob.mockResolvedValueOnce(undefined);

      await controller.cancelJob(mockUser, jobId);

      expect(mockBackgroundJobService.cancelJob).toHaveBeenCalledWith(
        jobId,
        mockUser.accessKeyData,
      );
    });
  });
});
