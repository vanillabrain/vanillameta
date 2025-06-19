import { Controller, Get, Post, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MemoryMonitorService } from './memory-monitor.service';
import { MemoryMonitorMiddleware } from './memory-monitor.middleware';
import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

@ApiTags('System Monitoring')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('system/memory')
export class MemoryMonitorController {
  constructor(
    private readonly memoryMonitorService: MemoryMonitorService,
    private readonly memoryMonitorMiddleware: MemoryMonitorMiddleware,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: '현재 메모리 사용 통계 조회' })
  @ApiResponse({ status: 200, description: '메모리 통계 반환' })
  getMemoryStats() {
    return {
      status: 'success',
      data: this.memoryMonitorService.getMemoryStatistics(),
      timestamp: new Date(),
    };
  }

  @Get('current')
  @ApiOperation({ summary: '실시간 메모리 메트릭 조회' })
  @ApiResponse({ status: 200, description: '현재 메모리 메트릭' })
  getCurrentMemory() {
    const metrics = this.memoryMonitorMiddleware.getMemoryStats();

    return {
      status: 'success',
      data: {
        percentUsed: metrics.percentUsed.toFixed(2) + '%',
        rss: this.formatBytes(metrics.rss),
        heapUsed: this.formatBytes(metrics.heapUsed),
        heapTotal: this.formatBytes(metrics.heapTotal),
        external: this.formatBytes(metrics.external),
        arrayBuffers: this.formatBytes(metrics.arrayBuffers),
        available: this.formatBytes(metrics.available),
        timestamp: metrics.timestamp,
      },
    };
  }

  @Get('recommendations')
  @ApiOperation({ summary: '메모리 최적화 권장사항 조회' })
  @ApiResponse({ status: 200, description: '최적화 권장사항 목록' })
  getOptimizationRecommendations() {
    const recommendations = this.memoryMonitorService.getOptimizationRecommendations();

    return {
      status: 'success',
      data: {
        recommendations,
        count: recommendations.length,
      },
    };
  }

  @Post('gc')
  @ApiOperation({ summary: '수동 가비지 컬렉션 실행' })
  @ApiResponse({ status: 200, description: 'GC 실행 결과' })
  @ApiResponse({ status: 503, description: 'GC를 사용할 수 없음' })
  async forceGarbageCollection() {
    if (!global.gc) {
      throw new HttpException(
        'Garbage collection is not exposed. Server must be started with --expose-gc flag.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const before = process.memoryUsage();
    const startTime = Date.now();

    global.gc();

    const after = process.memoryUsage();
    const duration = Date.now() - startTime;

    return {
      status: 'success',
      data: {
        before: {
          rss: this.formatBytes(before.rss),
          heapUsed: this.formatBytes(before.heapUsed),
          heapTotal: this.formatBytes(before.heapTotal),
        },
        after: {
          rss: this.formatBytes(after.rss),
          heapUsed: this.formatBytes(after.heapUsed),
          heapTotal: this.formatBytes(after.heapTotal),
        },
        freed: {
          rss: this.formatBytes(before.rss - after.rss),
          heapUsed: this.formatBytes(before.heapUsed - after.heapUsed),
        },
        duration: `${duration}ms`,
      },
    };
  }

  @Post('heap-snapshot')
  @ApiOperation({ summary: '힙 스냅샷 생성' })
  @ApiResponse({ status: 200, description: '스냅샷 생성 성공' })
  @ApiResponse({ status: 500, description: '스냅샷 생성 실패' })
  async createHeapSnapshot() {
    try {
      const filename = this.memoryMonitorMiddleware.createHeapSnapshot();
      const stats = await fs.promises.stat(filename);

      return {
        status: 'success',
        data: {
          filename,
          size: this.formatBytes(stats.size),
          createdAt: stats.birthtime,
          message: 'Heap snapshot created successfully. File will be available for 10 minutes.',
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create heap snapshot: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('heap-snapshot/:filename')
  @ApiOperation({ summary: '힙 스냅샷 다운로드' })
  @ApiResponse({ status: 200, description: '스냅샷 파일' })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async downloadHeapSnapshot(filename: string) {
    const filepath = `/tmp/${filename}`;

    try {
      await fs.promises.access(filepath);
      const content = await readFile(filepath);

      return {
        status: 'success',
        data: {
          filename,
          size: this.formatBytes(content.length),
          content: content.toString('base64'), // Base64로 인코딩하여 전송
        },
      };
    } catch (error) {
      throw new HttpException('Heap snapshot file not found', HttpStatus.NOT_FOUND);
    }
  }

  @Get('pressure')
  @ApiOperation({ summary: '메모리 압박 상태 확인' })
  @ApiResponse({ status: 200, description: '메모리 압박 상태' })
  checkMemoryPressure() {
    const metrics = this.memoryMonitorMiddleware.getMemoryStats();
    const percentUsed = metrics.percentUsed / 100;

    let status = 'normal';
    let level = 'green';
    let message = '메모리 사용량이 정상입니다.';

    if (percentUsed >= 0.9) {
      status = 'critical';
      level = 'red';
      message = '메모리가 임계 수준에 도달했습니다. 서비스가 불안정할 수 있습니다.';
    } else if (percentUsed >= 0.8) {
      status = 'warning';
      level = 'yellow';
      message = '메모리 사용량이 높습니다. 최적화가 필요합니다.';
    } else if (percentUsed >= 0.6) {
      status = 'caution';
      level = 'orange';
      message = '메모리 사용량을 모니터링하세요.';
    }

    return {
      status: 'success',
      data: {
        pressure: {
          status,
          level,
          percentUsed: (percentUsed * 100).toFixed(2) + '%',
          message,
        },
        thresholds: {
          warning: '80%',
          critical: '90%',
        },
        currentUsage: {
          rss: this.formatBytes(metrics.rss),
          heap: this.formatBytes(metrics.heapUsed),
          available: this.formatBytes(metrics.available),
        },
      },
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
