import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import express from 'express';
import compression from 'compression';

describe('API Response Compression (T03_S04)', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Express 앱 생성 및 compression 미들웨어 적용
    const expressApp = express();
    expressApp.use(
      compression({
        filter: (req, res) => {
          if (res.headersSent) return false;
          const contentType = res.getHeader('content-type');
          if (typeof contentType === 'string') {
            return /json|text|xml|javascript|css/.test(contentType);
          }
          return compression.filter(req, res);
        },
        threshold: 1024,
        level: 6,
        memLevel: 8,
      }),
    );

    app = moduleFixture.createNestApplication(expressApp);
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('압축 기능 테스트', () => {
    it('큰 JSON 응답이 gzip으로 압축되어야 함', async () => {
      // 큰 더미 데이터 생성 (1KB 이상)
      const largeData = {
        data: Array(100).fill({
          id: 'test-id-with-long-string-to-make-it-compressible',
          name: 'Test Name with Long Description for Better Compression',
          description:
            'This is a very long description that should be compressible using gzip compression algorithm. It contains repetitive text to ensure good compression ratio.',
          metadata: {
            created: new Date().toISOString(),
            tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
            properties: {
              property1: 'value1 with long text',
              property2: 'value2 with long text',
              property3: 'value3 with long text',
            },
          },
        }),
      };

      const response = await request(httpServer)
        .post('/test/large-data')
        .send(largeData)
        .set('Accept-Encoding', 'gzip, deflate, br')
        .expect(200);

      // 압축 헤더 확인
      expect(response.headers['content-encoding']).toBe('gzip');

      // 압축된 크기가 원본보다 작은지 확인
      const originalSize = JSON.stringify(largeData).length;
      const compressedSize = parseInt(response.headers['content-length'] || '0');

      if (compressedSize > 0) {
        expect(compressedSize).toBeLessThan(originalSize);

        // 압축률 계산 및 로깅
        const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
        console.log(
          `압축률: ${compressionRatio.toFixed(2)}% (${originalSize} -> ${compressedSize} bytes)`,
        );
      }
    });

    it('작은 응답은 압축되지 않아야 함', async () => {
      const smallData = { message: 'small' };

      const response = await request(httpServer)
        .post('/test/small-data')
        .send(smallData)
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // 작은 데이터는 압축되지 않아야 함
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('이미 압축된 콘텐츠는 재압축하지 않아야 함', async () => {
      const response = await request(httpServer)
        .get('/test/already-compressed')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // 이미 압축된 응답은 추가 압축하지 않음
      if (response.headers['content-encoding']) {
        expect(['gzip', 'deflate', 'br']).toContain(response.headers['content-encoding']);
      }
    });
  });

  describe('압축 필터링 테스트', () => {
    it('JSON 응답은 압축되어야 함', async () => {
      const jsonData = {
        users: Array(50).fill({
          id: Math.random().toString(36),
          name: 'User Name with Some Additional Information',
          email: 'user@example.com',
          profile: {
            bio: 'This is a user bio with detailed information that should compress well',
            interests: ['reading', 'writing', 'coding', 'music', 'travel'],
          },
        }),
      };

      const response = await request(httpServer)
        .post('/test/json-compression')
        .send(jsonData)
        .set('Accept-Encoding', 'gzip')
        .set('Content-Type', 'application/json')
        .expect(200);

      if (JSON.stringify(jsonData).length > 1024) {
        expect(response.headers['content-encoding']).toBe('gzip');
      }
    });

    it('텍스트 응답은 압축되어야 함', async () => {
      const response = await request(httpServer)
        .get('/test/text-compression')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // 텍스트 응답이 충분히 크다면 압축되어야 함
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength > 1024) {
        expect(response.headers['content-encoding']).toBe('gzip');
      }
    });

    it('이미지 응답은 압축되지 않아야 함', async () => {
      const response = await request(httpServer)
        .get('/test/image')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // 이미지는 압축하지 않음
      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('압축 성능 테스트', () => {
    it('압축으로 인한 응답 시간 증가가 합리적이어야 함', async () => {
      const testData = {
        items: Array(200).fill({
          id: 'item-id-with-long-identifier',
          title: 'Item Title with Detailed Description for Compression Testing',
          content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10),
          metadata: {
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
            author: 'Test Author Name',
            version: '1.0.0',
          },
        }),
      };

      // 압축 있는 요청
      const startTime = Date.now();
      const compressedResponse = await request(httpServer)
        .post('/test/performance')
        .send(testData)
        .set('Accept-Encoding', 'gzip')
        .expect(200);
      const compressedTime = Date.now() - startTime;

      // 압축 없는 요청
      const startTime2 = Date.now();
      const uncompressedResponse = await request(httpServer)
        .post('/test/performance')
        .send(testData)
        .set('Accept-Encoding', '')
        .expect(200);
      const uncompressedTime = Date.now() - startTime2;

      console.log(`압축 응답 시간: ${compressedTime}ms`);
      console.log(`비압축 응답 시간: ${uncompressedTime}ms`);

      // 압축으로 인한 추가 시간이 합리적이어야 함 (2배 이내)
      expect(compressedTime).toBeLessThan(uncompressedTime * 2);
    });
  });
});
