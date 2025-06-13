import { Controller, Get, Post, Body, Res, Header } from '@nestjs/common';
import { Response } from 'express';

@Controller('test')
export class TestCompressionController {
  
  @Post('large-data')
  @Header('Content-Type', 'application/json')
  async getLargeData(@Body() data: any, @Res() res: Response) {
    // 요청받은 데이터를 그대로 반환 (압축 테스트용)
    res.json({
      message: 'Large data response for compression testing',
      timestamp: new Date().toISOString(),
      receivedData: data,
      additionalData: {
        compressionInfo: 'This response should be compressed if larger than 1KB',
        testDescription: 'Testing API response compression with large JSON payload',
        metadata: {
          serverTime: Date.now(),
          requestSize: JSON.stringify(data).length,
          environment: process.env.NODE_ENV || 'unknown'
        }
      }
    });
  }

  @Post('small-data')
  @Header('Content-Type', 'application/json')
  async getSmallData(@Body() data: any, @Res() res: Response) {
    // 작은 응답 (압축되지 않아야 함)
    res.json({
      message: 'Small response',
      data: data
    });
  }

  @Get('already-compressed')
  @Header('Content-Encoding', 'gzip')
  async getAlreadyCompressed(@Res() res: Response) {
    // 이미 압축된 것으로 표시된 응답
    res.json({
      message: 'This response is already marked as compressed',
      timestamp: new Date().toISOString()
    });
  }

  @Post('json-compression')
  @Header('Content-Type', 'application/json')
  async testJsonCompression(@Body() data: any, @Res() res: Response) {
    res.json({
      message: 'JSON compression test',
      originalData: data,
      processedAt: new Date().toISOString(),
      compressionDetails: {
        shouldCompress: JSON.stringify(data).length > 1024,
        originalSize: JSON.stringify(data).length,
        contentType: 'application/json'
      }
    });
  }

  @Get('text-compression')
  @Header('Content-Type', 'text/plain')
  async testTextCompression(@Res() res: Response) {
    // 큰 텍스트 응답 생성
    const largeText = `
This is a large text response for testing compression functionality.
${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100)}
    
API Response Compression Test Results:
- This text should be compressed if it exceeds 1KB threshold
- Compression algorithm: gzip
- Compression level: 6 (balance between speed and compression ratio)
- Memory level: 8 (optimized for Lambda environment)
- Filter: Only JSON, text, XML, JavaScript, and CSS content types
- Threshold: 1024 bytes (1KB)

Performance expectations:
- 30-50% reduction in payload size for text content
- 70-80% reduction for repetitive JSON data
- Improved network transfer time, especially on mobile
- Minimal CPU overhead with level 6 compression

${new Date().toISOString()}
    `.trim();

    res.type('text/plain').send(largeText);
  }

  @Get('image')
  @Header('Content-Type', 'image/png')
  async testImageResponse(@Res() res: Response) {
    // 가짜 이미지 바이너리 데이터 (압축되지 않아야 함)
    const fakeImageData = Buffer.alloc(2048, 0x89); // PNG 시그니처로 시작하는 더미 데이터
    res.type('image/png').send(fakeImageData);
  }

  @Post('performance')
  @Header('Content-Type', 'application/json')
  async testPerformance(@Body() data: any, @Res() res: Response) {
    const startTime = Date.now();
    
    // 처리 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const processingTime = Date.now() - startTime;
    
    res.json({
      message: 'Performance test response',
      data: data,
      performance: {
        processingTime: processingTime,
        responseGenerated: new Date().toISOString(),
        dataSize: JSON.stringify(data).length,
        compressionEligible: JSON.stringify(data).length > 1024
      },
      metadata: {
        serverInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      }
    });
  }

  @Get('compression-info')
  @Header('Content-Type', 'application/json')
  async getCompressionInfo(@Res() res: Response) {
    res.json({
      compressionSettings: {
        enabled: true,
        algorithm: 'gzip',
        threshold: '1024 bytes',
        level: 6,
        memLevel: 8,
        supportedTypes: [
          'application/json',
          'text/plain',
          'text/html',
          'text/css',
          'text/xml',
          'application/xml',
          'application/javascript',
          'text/javascript'
        ]
      },
      apiGatewaySettings: {
        minimumCompressionSize: 1024,
        binaryMediaTypes: ['*/*']
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        runtime: 'AWS Lambda',
        timestamp: new Date().toISOString()
      }
    });
  }
}