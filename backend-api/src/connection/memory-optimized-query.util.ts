import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import { Logger } from '@nestjs/common';
import * as zlib from 'zlib';

const pipelineAsync = promisify(pipeline);

export class MemoryOptimizedQueryUtil {
  private static readonly logger = new Logger(MemoryOptimizedQueryUtil.name);
  
  /**
   * 대용량 쿼리 결과를 청크 단위로 처리
   */
  static createChunkTransform(chunkSize = 1000): Transform {
    let buffer: any[] = [];
    
    return new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        buffer.push(row);
        
        if (buffer.length >= chunkSize) {
          this.push(buffer);
          buffer = [];
        }
        
        callback();
      },
      flush(callback) {
        if (buffer.length > 0) {
          this.push(buffer);
        }
        callback();
      },
    });
  }

  /**
   * 메모리 효율적인 집계 변환
   */
  static createAggregateTransform(
    groupBy: string,
    aggregateFn: (group: any[]) => any,
  ): Transform {
    const groups = new Map<string, any[]>();
    
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // 청크 내의 각 행을 그룹별로 분류
        for (const row of chunk) {
          const key = row[groupBy] || 'undefined';
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(row);
        }
        
        // 메모리 압박 시 중간 결과 출력
        if (groups.size > 1000) {
          const results = [];
          groups.forEach((group, key) => {
            results.push({
              [groupBy]: key,
              ...aggregateFn(group),
            });
          });
          this.push(results);
          groups.clear();
        }
        
        callback();
      },
      flush(callback) {
        // 남은 그룹 처리
        const results = [];
        groups.forEach((group, key) => {
          results.push({
            [groupBy]: key,
            ...aggregateFn(group),
          });
        });
        
        if (results.length > 0) {
          this.push(results);
        }
        
        callback();
      },
    });
  }

  /**
   * 데이터 압축 변환
   */
  static createCompressionTransform(): Transform {
    return new Transform({
      objectMode: true,
      async transform(chunk, encoding, callback) {
        try {
          const jsonStr = JSON.stringify(chunk);
          const compressed = await promisify(zlib.gzip)(Buffer.from(jsonStr));
          
          this.push({
            compressed: true,
            data: compressed.toString('base64'),
            originalSize: jsonStr.length,
            compressedSize: compressed.length,
            compressionRatio: (1 - compressed.length / jsonStr.length) * 100,
          });
          
          callback();
        } catch (error) {
          callback(error);
        }
      },
    });
  }

  /**
   * 샘플링 변환 (대용량 데이터의 일부만 추출)
   */
  static createSamplingTransform(sampleRate = 0.1): Transform {
    let totalCount = 0;
    let sampledCount = 0;
    
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const sampled = [];
        
        for (const row of chunk) {
          totalCount++;
          if (Math.random() < sampleRate) {
            sampled.push(row);
            sampledCount++;
          }
        }
        
        if (sampled.length > 0) {
          this.push({
            data: sampled,
            metadata: {
              totalCount,
              sampledCount,
              sampleRate,
            },
          });
        }
        
        callback();
      },
    });
  }

  /**
   * 프로젝션 변환 (필요한 필드만 선택)
   */
  static createProjectionTransform(fields: string[]): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const projected = chunk.map((row: any) => {
          const projectedRow: any = {};
          fields.forEach(field => {
            if (field in row) {
              projectedRow[field] = row[field];
            }
          });
          return projectedRow;
        });
        
        this.push(projected);
        callback();
      },
    });
  }

  /**
   * 메모리 사용량 모니터링 변환
   */
  static createMemoryMonitorTransform(thresholdMB = 100): Transform {
    let processedRows = 0;
    let lastMemCheck = Date.now();
    const initialMem = process.memoryUsage().heapUsed;
    
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        processedRows += chunk.length;
        
        // 1초마다 메모리 체크
        const now = Date.now();
        if (now - lastMemCheck > 1000) {
          const currentMem = process.memoryUsage().heapUsed;
          const memIncrease = (currentMem - initialMem) / 1024 / 1024;
          
          if (memIncrease > thresholdMB) {
            this.logger.warn(`Memory usage increased by ${memIncrease.toFixed(2)}MB after processing ${processedRows} rows`);
            
            // 강제 GC 시도
            if (global.gc) {
              global.gc();
              this.logger.info('Forced garbage collection due to high memory usage');
            }
          }
          
          lastMemCheck = now;
        }
        
        this.push(chunk);
        callback();
      },
    });
  }

  /**
   * 중복 제거 변환 (메모리 효율적)
   */
  static createDeduplicationTransform(keyField: string, maxSize = 10000): Transform {
    const seen = new Set<string>();
    const lru: string[] = []; // LRU 캐시
    
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const deduplicated = [];
        
        for (const row of chunk) {
          const key = String(row[keyField]);
          
          if (!seen.has(key)) {
            seen.add(key);
            lru.push(key);
            deduplicated.push(row);
            
            // LRU 캐시 크기 제한
            if (seen.size > maxSize) {
              const oldest = lru.shift()!;
              seen.delete(oldest);
            }
          }
        }
        
        if (deduplicated.length > 0) {
          this.push(deduplicated);
        }
        
        callback();
      },
    });
  }

  /**
   * 데이터 변환 파이프라인 생성
   */
  static async createOptimizedPipeline(
    source: NodeJS.ReadableStream,
    transforms: Transform[],
    destination: NodeJS.WritableStream,
  ): Promise<void> {
    // 에러 처리를 위한 래퍼
    const streams = [source, ...transforms, destination];
    
    try {
      await pipelineAsync(...streams);
    } catch (error) {
      this.logger.error('Pipeline error:', error);
      
      // 모든 스트림 정리
      streams.forEach(stream => {
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
      });
      
      throw error;
    }
  }

  /**
   * 배치 처리를 위한 변환
   */
  static createBatchTransform(
    batchSize: number,
    processFn: (batch: any[]) => Promise<any>,
  ): Transform {
    let batch: any[] = [];
    
    return new Transform({
      objectMode: true,
      async transform(chunk, encoding, callback) {
        batch.push(...chunk);
        
        while (batch.length >= batchSize) {
          const processingBatch = batch.slice(0, batchSize);
          batch = batch.slice(batchSize);
          
          try {
            const result = await processFn(processingBatch);
            if (result) {
              this.push(result);
            }
          } catch (error) {
            this.logger.error('Batch processing error:', error);
          }
        }
        
        callback();
      },
      async flush(callback) {
        if (batch.length > 0) {
          try {
            const result = await processFn(batch);
            if (result) {
              this.push(result);
            }
          } catch (error) {
            this.logger.error('Final batch processing error:', error);
          }
        }
        callback();
      },
    });
  }
}