import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';

describe('API Compression (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 압축 미들웨어 설정 (serverless.ts와 동일)
    app.use(
      compression({
        filter: (req, res) => {
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

    app.use(cookieParser());
    app.setGlobalPrefix('v1');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Compression Tests', () => {
    it('작은 응답은 압축되지 않아야 함 (< 1KB)', () => {
      return request(app.getHttpServer())
        .get('/v1/health')
        .set('Accept-Encoding', 'gzip')
        .expect(200)
        .expect(res => {
          // Content-Encoding 헤더가 없어야 함
          expect(res.headers['content-encoding']).toBeUndefined();
        });
    });

    it('큰 JSON 응답은 gzip으로 압축되어야 함', async () => {
      // 1KB 이상의 더미 데이터 생성
      const largeData = {
        items: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: `This is a description for item ${i} with some additional text to make it larger`,
            metadata: {
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
              properties: {
                color: 'blue',
                size: 'large',
                weight: '10kg',
                material: 'plastic',
              },
            },
          })),
      };

      // Mock 엔드포인트 생성
      app.use('/v1/test/large', (req, res) => {
        res.json(largeData);
      });

      const response = await request(app.getHttpServer())
        .get('/v1/test/large')
        .set('Accept-Encoding', 'gzip, deflate')
        .expect(200);

      // gzip 압축이 적용되었는지 확인
      expect(response.headers['content-encoding']).toBe('gzip');

      // 압축된 데이터가 원본보다 작은지 확인
      const originalSize = JSON.stringify(largeData).length;
      const compressedSize = response.text.length;
      expect(compressedSize).toBeLessThan(originalSize);
    });

    it('Accept-Encoding 헤더가 없으면 압축하지 않아야 함', async () => {
      // Mock 엔드포인트
      app.use('/v1/test/no-compression', (req, res) => {
        res.json({
          data: 'x'.repeat(2000), // 2KB 데이터
        });
      });

      const response = await request(app.getHttpServer())
        .get('/v1/test/no-compression')
        // Accept-Encoding 헤더를 보내지 않음
        .expect(200);

      // 압축이 적용되지 않았는지 확인
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('텍스트 콘텐츠도 압축되어야 함', async () => {
      // Mock 텍스트 엔드포인트
      app.use('/v1/test/text', (req, res) => {
        res.type('text/plain');
        res.send('Lorem ipsum dolor sit amet, '.repeat(100)); // 큰 텍스트
      });

      const response = await request(app.getHttpServer())
        .get('/v1/test/text')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('이미지 파일은 압축되지 않아야 함', async () => {
      // Mock 이미지 엔드포인트
      app.use('/v1/test/image', (req, res) => {
        res.type('image/png');
        // 더미 바이너리 데이터
        res.send(Buffer.alloc(2000, 0));
      });

      const response = await request(app.getHttpServer())
        .get('/v1/test/image')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // 이미지는 압축되지 않아야 함
      expect(response.headers['content-encoding']).toBeUndefined();
      expect(response.headers['content-type']).toContain('image/png');
    });

    it('XML 콘텐츠도 압축되어야 함', async () => {
      // Mock XML 엔드포인트
      app.use('/v1/test/xml', (req, res) => {
        res.type('application/xml');
        const xmlData = `
          <root>
            ${Array(50)
              .fill(null)
              .map(
                (_, i) => `
              <item id="${i}">
                <name>Item ${i}</name>
                <description>Description for item ${i}</description>
              </item>
            `,
              )
              .join('')}
          </root>
        `;
        res.send(xmlData);
      });

      const response = await request(app.getHttpServer())
        .get('/v1/test/xml')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.headers['content-type']).toContain('application/xml');
    });
  });

  describe('Compression Performance', () => {
    it('압축이 응답 시간에 미치는 영향이 최소화되어야 함', async () => {
      const largeData = {
        items: Array(200)
          .fill(null)
          .map((_, i) => ({
            id: i,
            data: 'x'.repeat(100),
          })),
      };

      app.use('/v1/test/performance', (req, res) => {
        res.json(largeData);
      });

      // 압축 없이 측정
      const startNoCompression = Date.now();
      await request(app.getHttpServer()).get('/v1/test/performance').expect(200);
      const timeNoCompression = Date.now() - startNoCompression;

      // 압축과 함께 측정
      const startWithCompression = Date.now();
      await request(app.getHttpServer())
        .get('/v1/test/performance')
        .set('Accept-Encoding', 'gzip')
        .expect(200);
      const timeWithCompression = Date.now() - startWithCompression;

      // 압축으로 인한 오버헤드가 50ms 이하여야 함
      const overhead = timeWithCompression - timeNoCompression;
      expect(overhead).toBeLessThan(50);
    });
  });
});
