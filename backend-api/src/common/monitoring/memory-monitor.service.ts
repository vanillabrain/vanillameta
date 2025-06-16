import { Injectable, Logger } from '@nestjs/common';
import * as v8 from 'v8';
import { Transform, Readable, Writable } from 'stream';
import { CustomLoggerService } from '../logger/logger.service';

interface MemoryLeakDetection {
  suspect: string;
  retainedSize: number;
  instances: number;
  growth: number;
}

interface StreamProcessingOptions {
  highWaterMark?: number;
  encoding?: BufferEncoding;
  objectMode?: boolean;
}

@Injectable()
export class MemoryMonitorService {
  private readonly logger = new Logger(MemoryMonitorService.name);
  private memorySnapshots: Map<string, any> = new Map();
  private readonly MAX_SNAPSHOTS = 5;

  // WeakMap과 Set을 사용하여 메모리 누수 방지 및 카운팅
  private readonly streamRegistry = new WeakMap<Readable, StreamMetadata>();
  private readonly activeStreams = new Set<Readable>();
  private activeStreamCount = 0;

  constructor(private readonly customLogger: CustomLoggerService) {
    // 메모리 누수 감지를 위한 주기적 체크
    this.startMemoryLeakDetection();
  }

  /**
   * 메모리 효율적인 스트림 변환 생성
   */
  createMemoryEfficientTransform(
    transformFn: (chunk: any, encoding: string) => any,
    options?: StreamProcessingOptions,
  ): Transform {
    const defaultOptions = {
      highWaterMark: 16 * 1024, // 16KB 청크
      objectMode: true,
      ...options,
    };

    const transform = new Transform({
      ...defaultOptions,
      transform: (chunk, encoding, callback) => {
        try {
          const result = transformFn(chunk, encoding);

          // 메모리 압박 시 백프레셔 적용
          if (this.isMemoryPressure()) {
            setImmediate(() => callback(null, result));
          } else {
            callback(null, result);
          }
        } catch (error) {
          callback(error);
        }
      },
    });

    // 스트림 메타데이터 추적
    this.trackStream(transform);

    return transform;
  }

  /**
   * 대용량 배열을 스트림으로 처리
   */
  createArrayStream<T>(array: T[], chunkSize = 1000, options?: StreamProcessingOptions): Readable {
    let index = 0;
    const self = this; // MemoryMonitorService 인스턴스 참조

    const stream = new Readable({
      objectMode: true,
      highWaterMark: chunkSize,
      ...options,
      read() {
        const chunk = array.slice(index, index + chunkSize);

        if (chunk.length === 0) {
          this.push(null); // 스트림 종료
        } else {
          this.push(chunk);
          index += chunkSize;

          // 메모리 압박 시 일시 중지
          if (self.isMemoryPressure()) {
            setImmediate(() => this.read());
            return false;
          }
        }
      },
    });

    this.trackStream(stream);
    return stream;
  }

  /**
   * 스트림 파이프라인 생성 (메모리 최적화)
   */
  createOptimizedPipeline(
    source: Readable,
    transforms: Transform[],
    destination: Writable,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let pipeline = source;

      // 각 변환 단계에 백프레셔 처리 추가
      transforms.forEach(transform => {
        pipeline = pipeline.pipe(transform);
      });

      pipeline
        .pipe(destination)
        .on('finish', () => {
          this.cleanupStreams([source, ...transforms]);
          resolve();
        })
        .on('error', error => {
          this.cleanupStreams([source, ...transforms]);
          reject(error);
        });

      // 메모리 압박 시 파이프라인 일시 중지
      this.monitorPipeline(source, transforms, destination);
    });
  }

  /**
   * 메모리 압박 상태 확인
   */
  private isMemoryPressure(): boolean {
    const usage = process.memoryUsage();
    const maxMemory = 3 * 1024 * 1024 * 1024; // 3GB
    return usage.rss > maxMemory * 0.8; // 80% 이상 사용 시
  }

  /**
   * 스트림 추적
   */
  private trackStream(stream: Readable): void {
    const metadata: StreamMetadata = {
      createdAt: Date.now(),
      type: stream.constructor.name,
      highWaterMark: stream.readableHighWaterMark,
    };

    this.streamRegistry.set(stream, metadata);
    this.activeStreams.add(stream);
    this.activeStreamCount++;

    stream.on('close', () => {
      if (this.activeStreams.has(stream)) {
        this.activeStreams.delete(stream);
        this.activeStreamCount--;
      }
    });
  }

  /**
   * 스트림 정리
   */
  private cleanupStreams(streams: Readable[]): void {
    streams.forEach(stream => {
      if (!stream.destroyed) {
        stream.destroy();
      }
      if (this.activeStreams.has(stream)) {
        this.activeStreams.delete(stream);
        this.activeStreamCount--;
      }
    });
  }

  /**
   * 파이프라인 모니터링
   */
  private monitorPipeline(source: Readable, transforms: Transform[], destination: Writable): void {
    const checkInterval = setInterval(() => {
      if (this.isMemoryPressure()) {
        // 메모리 압박 시 스트림 일시 중지
        source.pause();
        transforms.forEach(t => t.pause());

        this.customLogger.warn('Pipeline paused due to memory pressure', 'MemoryMonitor');

        // 1초 후 재개
        setTimeout(() => {
          source.resume();
          transforms.forEach(t => t.resume());
        }, 1000);
      }

      // 파이프라인 완료 시 모니터링 중지
      if (destination.writableEnded) {
        clearInterval(checkInterval);
      }
    }, 500); // 500ms마다 체크
  }

  /**
   * 메모리 누수 감지
   */
  private startMemoryLeakDetection(): void {
    setInterval(() => {
      const snapshot = this.takeMemorySnapshot();
      this.analyzeMemoryGrowth(snapshot);
    }, 300000); // 5분마다 실행
  }

  /**
   * 메모리 스냅샷 생성
   */
  private takeMemorySnapshot(): any {
    const timestamp = Date.now();
    const heapStats = v8.getHeapStatistics();
    const memUsage = process.memoryUsage();

    const snapshot = {
      timestamp,
      heapStats,
      memUsage,
      objectCounts: this.getObjectCounts(),
    };

    // 스냅샷 저장 (최대 5개 유지)
    this.memorySnapshots.set(timestamp.toString(), snapshot);
    if (this.memorySnapshots.size > this.MAX_SNAPSHOTS) {
      const oldestKey = Array.from(this.memorySnapshots.keys())[0];
      this.memorySnapshots.delete(oldestKey);
    }

    return snapshot;
  }

  /**
   * 객체 수 카운트 (메모리 누수 감지용)
   */
  private getObjectCounts(): Map<string, number> {
    const counts = new Map<string, number>();

    // 주요 객체 타입 추적
    try {
      // 활성 스트림 수
      counts.set('ActiveStreams', this.activeStreamCount);

      // 기타 중요 메트릭
      counts.set('MemorySnapshots', this.memorySnapshots.size);
    } catch (error) {
      this.logger.error('Failed to get object counts:', error);
    }

    return counts;
  }

  /**
   * 메모리 증가 분석
   */
  private analyzeMemoryGrowth(currentSnapshot: any): void {
    const snapshots = Array.from(this.memorySnapshots.values());
    if (snapshots.length < 2) return;

    const previousSnapshot = snapshots[snapshots.length - 2];
    const heapGrowth =
      currentSnapshot.heapStats.used_heap_size - previousSnapshot.heapStats.used_heap_size;
    const rssGrowth = currentSnapshot.memUsage.rss - previousSnapshot.memUsage.rss;

    // 비정상적인 메모리 증가 감지 (100MB 이상)
    if (heapGrowth > 100 * 1024 * 1024 || rssGrowth > 100 * 1024 * 1024) {
      this.customLogger.warn('Potential memory leak detected', 'MemoryMonitor', {
        heapGrowth: this.formatBytes(heapGrowth),
        rssGrowth: this.formatBytes(rssGrowth),
        timeDelta: `${(currentSnapshot.timestamp - previousSnapshot.timestamp) / 1000}s`,
      });

      // 메모리 누수 원인 분석
      const leaks = this.detectMemoryLeaks(previousSnapshot, currentSnapshot);
      if (leaks.length > 0) {
        this.customLogger.error('Memory leak suspects found', null, 'MemoryMonitor', { leaks });
      }
    }
  }

  /**
   * 메모리 누수 감지
   */
  private detectMemoryLeaks(previousSnapshot: any, currentSnapshot: any): MemoryLeakDetection[] {
    const leaks: MemoryLeakDetection[] = [];

    // 객체 수 증가 분석
    currentSnapshot.objectCounts.forEach((count: number, type: string) => {
      const previousCount = previousSnapshot.objectCounts.get(type) || 0;
      const growth = count - previousCount;

      if (growth > 100) {
        // 100개 이상 증가
        leaks.push({
          suspect: type,
          retainedSize: 0, // 실제 크기는 프로파일러 필요
          instances: count,
          growth,
        });
      }
    });

    return leaks;
  }

  /**
   * 바이트를 읽기 쉬운 형식으로 변환
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 메모리 최적화 권장사항 제공
   */
  public getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    // 힙 사용률 확인
    const heapUsagePercent = (heapStats.used_heap_size / heapStats.heap_size_limit) * 100;
    if (heapUsagePercent > 70) {
      recommendations.push(
        `힙 사용률이 ${heapUsagePercent.toFixed(1)}%로 높습니다. 대용량 객체 생성을 줄이세요.`,
      );
    }

    // 외부 메모리 사용 확인
    if (memUsage.external > 100 * 1024 * 1024) {
      // 100MB 이상
      recommendations.push(
        `외부 메모리 사용이 ${this.formatBytes(
          memUsage.external,
        )}로 높습니다. Buffer 사용을 최적화하세요.`,
      );
    }

    // ArrayBuffer 사용 확인
    if (memUsage.arrayBuffers > 50 * 1024 * 1024) {
      // 50MB 이상
      recommendations.push(
        `ArrayBuffer 사용이 ${this.formatBytes(
          memUsage.arrayBuffers,
        )}입니다. TypedArray 정리를 확인하세요.`,
      );
    }

    // 스트림 수 확인
    if (this.activeStreamCount > 10) {
      recommendations.push(
        `활성 스트림이 ${this.activeStreamCount}개입니다. 사용 완료된 스트림을 정리하세요.`,
      );
    }

    return recommendations;
  }

  /**
   * 메모리 사용 통계 반환 (getMemoryStats 별칭)
   */
  public getMemoryStats() {
    const memUsage = process.memoryUsage();
    const totalMemory = 3072 * 1024 * 1024; // 3GB Lambda 최대 메모리
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      percentUsed: (memUsage.rss / totalMemory) * 100,
      available: totalMemory - memUsage.rss,
    };
  }

  /**
   * 메모리 사용 통계 반환
   */
  public getMemoryStatistics() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const snapshots = Array.from(this.memorySnapshots.values());

    return {
      current: {
        rss: this.formatBytes(memUsage.rss),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        heapUsed: this.formatBytes(memUsage.heapUsed),
        external: this.formatBytes(memUsage.external),
        arrayBuffers: this.formatBytes(memUsage.arrayBuffers),
      },
      heap: {
        totalHeapSize: this.formatBytes(heapStats.total_heap_size),
        usedHeapSize: this.formatBytes(heapStats.used_heap_size),
        heapSizeLimit: this.formatBytes(heapStats.heap_size_limit),
        totalAvailableSize: this.formatBytes(heapStats.total_available_size),
      },
      trends: {
        snapshotCount: snapshots.length,
        latestSnapshot: snapshots[snapshots.length - 1],
      },
      recommendations: this.getOptimizationRecommendations(),
    };
  }
}

interface StreamMetadata {
  createdAt: number;
  type: string;
  highWaterMark: number;
}
