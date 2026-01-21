import { Injectable, Logger } from '@nestjs/common';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export enum CompressionType {
  NONE = 0,
  GZIP = 1,
  BROTLI = 2,
}

interface CompressedData {
  type: CompressionType;
  data: string; // base64 encoded
  originalSize: number;
  compressedSize: number;
}

/**
 * 캐시 데이터 압축 서비스
 * 대용량 데이터를 효율적으로 압축하여 캐시 공간을 절약합니다.
 */
@Injectable()
export class CompressionService {
  private readonly logger = new Logger(CompressionService.name);
  private readonly MIN_COMPRESSION_SIZE = 1024; // 1KB
  private readonly MIN_COMPRESSION_RATIO = 0.9; // 10% 이상 압축되어야 함

  /**
   * 데이터 압축
   * @param data 압축할 데이터
   * @param forceCompression 강제 압축 여부
   * @returns 압축된 데이터 문자열
   */
  async compress(data: any, forceCompression = false): Promise<string> {
    try {
      const json = JSON.stringify(data);
      const originalSize = Buffer.byteLength(json, 'utf8');

      // 최소 크기 미만이면 압축하지 않음
      if (!forceCompression && originalSize < this.MIN_COMPRESSION_SIZE) {
        return JSON.stringify({
          type: CompressionType.NONE,
          data: Buffer.from(json).toString('base64'),
          originalSize,
          compressedSize: originalSize,
        } as CompressedData);
      }

      // 데이터 크기에 따라 압축 알고리즘 선택
      const compressionResult =
        originalSize > 10 * 1024 // 10KB 이상
          ? await this.compressBrotli(json, originalSize)
          : await this.compressGzip(json, originalSize);

      // 압축률 확인
      const compressionRatio = compressionResult.compressedSize / originalSize;

      if (!forceCompression && compressionRatio > this.MIN_COMPRESSION_RATIO) {
        // 압축 효과가 미미하면 원본 사용
        this.logger.debug(
          `Compression ratio ${compressionRatio.toFixed(
            2,
          )} is below threshold, using original data`,
        );

        return JSON.stringify({
          type: CompressionType.NONE,
          data: Buffer.from(json).toString('base64'),
          originalSize,
          compressedSize: originalSize,
        } as CompressedData);
      }

      this.logger.debug(
        `Compressed data from ${originalSize} to ${compressionResult.compressedSize} bytes ` +
          `(${((1 - compressionRatio) * 100).toFixed(1)}% reduction) using ${
            CompressionType[compressionResult.type]
          }`,
      );

      return JSON.stringify(compressionResult);
    } catch (error) {
      this.logger.error('Compression failed:', error);
      throw error;
    }
  }

  /**
   * 데이터 압축 해제
   * @param compressedStr 압축된 데이터 문자열
   * @returns 원본 데이터
   */
  async decompress(compressedStr: string): Promise<any> {
    try {
      const compressed: CompressedData = JSON.parse(compressedStr);

      if (compressed.type === CompressionType.NONE) {
        const json = Buffer.from(compressed.data, 'base64').toString('utf8');
        return JSON.parse(json);
      }

      const decompressed =
        compressed.type === CompressionType.BROTLI
          ? await this.decompressBrotli(compressed.data)
          : await this.decompressGzip(compressed.data);

      return JSON.parse(decompressed);
    } catch (error) {
      // 압축되지 않은 데이터일 수 있음
      try {
        return JSON.parse(compressedStr);
      } catch {
        this.logger.error('Decompression failed:', error);
        throw error;
      }
    }
  }

  /**
   * GZIP 압축
   */
  private async compressGzip(data: string, originalSize: number): Promise<CompressedData> {
    const compressed = await gzip(data, {
      level: zlib.constants.Z_DEFAULT_COMPRESSION,
    });

    return {
      type: CompressionType.GZIP,
      data: compressed.toString('base64'),
      originalSize,
      compressedSize: compressed.length,
    };
  }

  /**
   * GZIP 압축 해제
   */
  private async decompressGzip(data: string): Promise<string> {
    const buffer = Buffer.from(data, 'base64');
    const decompressed = await gunzip(buffer);
    return decompressed.toString('utf8');
  }

  /**
   * Brotli 압축
   */
  private async compressBrotli(data: string, originalSize: number): Promise<CompressedData> {
    const compressed = await brotliCompress(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // 0-11, 4는 균형잡힌 설정
      },
    });

    return {
      type: CompressionType.BROTLI,
      data: compressed.toString('base64'),
      originalSize,
      compressedSize: compressed.length,
    };
  }

  /**
   * Brotli 압축 해제
   */
  private async decompressBrotli(data: string): Promise<string> {
    const buffer = Buffer.from(data, 'base64');
    const decompressed = await brotliDecompress(buffer);
    return decompressed.toString('utf8');
  }

  /**
   * 압축 통계 계산
   */
  calculateCompressionStats(compressedStr: string): {
    type: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    spaceSaved: number;
  } | null {
    try {
      const compressed: CompressedData = JSON.parse(compressedStr);

      if (!compressed.originalSize || !compressed.compressedSize) {
        return null;
      }

      const compressionRatio = compressed.compressedSize / compressed.originalSize;
      const spaceSaved = compressed.originalSize - compressed.compressedSize;

      return {
        type: CompressionType[compressed.type],
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
        compressionRatio,
        spaceSaved,
      };
    } catch {
      return null;
    }
  }

  /**
   * 여러 데이터를 배치로 압축
   */
  async compressBatch(
    items: Array<{ key: string; data: any }>,
    forceCompression = false,
  ): Promise<Array<{ key: string; compressed: string; stats?: any }>> {
    const results = await Promise.all(
      items.map(async item => {
        try {
          const compressed = await this.compress(item.data, forceCompression);
          const stats = this.calculateCompressionStats(compressed);

          return {
            key: item.key,
            compressed,
            stats,
          };
        } catch (error) {
          this.logger.error(`Failed to compress item ${item.key}:`, error);

          // 압축 실패 시 원본 반환
          return {
            key: item.key,
            compressed: JSON.stringify(item.data),
            stats: null,
          };
        }
      }),
    );

    // 압축 통계 로깅
    const totalOriginal = results.reduce((sum, r) => sum + (r.stats?.originalSize || 0), 0);
    const totalCompressed = results.reduce((sum, r) => sum + (r.stats?.compressedSize || 0), 0);

    if (totalOriginal > 0) {
      const overallRatio = totalCompressed / totalOriginal;
      this.logger.log(
        `Batch compression completed: ${items.length} items, ` +
          `${totalOriginal} → ${totalCompressed} bytes ` +
          `(${((1 - overallRatio) * 100).toFixed(1)}% reduction)`,
      );
    }

    return results;
  }

  /**
   * 압축 가능 여부 확인
   */
  isCompressible(data: any): boolean {
    try {
      const json = JSON.stringify(data);
      const size = Buffer.byteLength(json, 'utf8');

      return size >= this.MIN_COMPRESSION_SIZE;
    } catch {
      return false;
    }
  }

  /**
   * 최적 압축 알고리즘 추천
   */
  recommendCompressionType(dataSize: number): CompressionType {
    if (dataSize < this.MIN_COMPRESSION_SIZE) {
      return CompressionType.NONE;
    }

    // 10KB 이상은 Brotli (더 나은 압축률)
    // 그 이하는 GZIP (더 빠른 압축/해제)
    return dataSize > 10 * 1024 ? CompressionType.BROTLI : CompressionType.GZIP;
  }
}
