import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  FieldSelection,
  PredefinedFields,
  NoFieldSelection,
} from './common/field-selection/field-selection.decorator';

@Controller('test-fields')
export class TestFieldSelectionController {
  @FieldSelection({
    allowedFields: [
      'id',
      'name',
      'email',
      'createdAt',
      'updatedAt',
      'profile.avatar',
      'profile.bio',
      'profile.location',
      'settings.theme',
      'settings.language',
      'dashboards.id',
      'dashboards.title',
      'dashboards.description',
    ],
    excludeFields: ['password', 'token', 'internalId'],
  })
  @Get('users')
  async getUsers(@Query('fields') fields?: string, @Res() res?: Response) {
    // 가상의 사용자 데이터 (실제로는 DB에서 조회)
    const users = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123', // 제외되어야 함
        token: 'jwt-token-here', // 제외되어야 함
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-06-01T00:00:00Z',
        profile: {
          avatar: 'https://example.com/avatar1.jpg',
          bio: 'Software Engineer with 5+ years experience',
          location: 'Seoul, Korea',
          privateNotes: 'Internal notes', // 허용되지 않은 필드
        },
        settings: {
          theme: 'dark',
          language: 'ko',
          internalConfig: 'secret-config', // 허용되지 않은 필드
        },
        dashboards: [
          {
            id: 101,
            title: 'Sales Dashboard',
            description: 'Monthly sales metrics',
            secretKey: 'dashboard-secret', // 허용되지 않은 필드
          },
          {
            id: 102,
            title: 'Analytics Dashboard',
            description: 'User behavior analytics',
            secretKey: 'dashboard-secret-2',
          },
        ],
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'secret456',
        token: 'jwt-token-2',
        createdAt: '2023-02-01T00:00:00Z',
        updatedAt: '2023-06-15T00:00:00Z',
        profile: {
          avatar: 'https://example.com/avatar2.jpg',
          bio: 'Data Scientist passionate about ML',
          location: 'Busan, Korea',
        },
        settings: {
          theme: 'light',
          language: 'en',
        },
        dashboards: [
          {
            id: 201,
            title: 'ML Model Performance',
            description: 'Machine learning model metrics',
          },
        ],
      },
    ];

    // 필드 선택 데모용 응답 헤더 추가
    if (res && fields) {
      res.header('X-Demo-Fields-Requested', fields);
      res.header('X-Demo-Total-Users', users.length.toString());
    }

    return res ? res.json(users) : users;
  }

  @PredefinedFields('userBasic') // id, email, name, createdAt만
  @Get('users/basic')
  async getUsersBasic() {
    const users = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-06-01T00:00:00Z',
        profile: {
          avatar: 'https://example.com/avatar1.jpg',
          bio: 'Software Engineer',
        },
      },
    ];

    return users;
  }

  @FieldSelection({
    allowedFields: [
      'id',
      'title',
      'description',
      'createdAt',
      'widgets.id',
      'widgets.name',
      'widgets.type',
      'widgets.order',
      'widgets.config.title',
      'widgets.config.chartType',
      'owner.id',
      'owner.name',
      'owner.email',
    ],
  })
  @Get('dashboards')
  async getDashboards(@Query('fields') fields?: string) {
    const dashboards = [
      {
        id: 1,
        title: 'Sales Performance Dashboard',
        description: 'Comprehensive sales metrics and KPIs',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-06-01T00:00:00Z',
        secretKey: 'dashboard-secret-key', // 허용되지 않음
        internalNotes: 'Internal comments', // 허용되지 않음
        owner: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          password: 'secret123', // 항상 제외됨
        },
        widgets: [
          {
            id: 101,
            name: 'Monthly Revenue',
            type: 'line-chart',
            order: 1,
            config: {
              title: 'Monthly Revenue Trend',
              chartType: 'line',
              xAxis: 'month',
              yAxis: 'revenue',
              secretConfig: 'internal-config', // 허용되지 않음
            },
            data: {
              // 대용량 실제 차트 데이터 (필드 선택으로 제외됨)
              series: Array(100).fill({ x: 'data', y: 'data' }),
            },
          },
          {
            id: 102,
            name: 'Customer Count',
            type: 'bar-chart',
            order: 2,
            config: {
              title: 'New Customers by Month',
              chartType: 'bar',
            },
            data: {
              series: Array(100).fill({ x: 'data', y: 'data' }),
            },
          },
        ],
      },
    ];

    return dashboards;
  }

  @FieldSelection({
    allowedFields: [
      'id',
      'name',
      'description',
      'rowCount',
      'createdAt',
      'columns.name',
      'columns.type',
      'columns.nullable',
      'source.type',
      'source.name',
    ],
  })
  @Get('datasets')
  async getDatasets(@Query('fields') fields?: string) {
    const datasets = [
      {
        id: 1,
        name: 'Sales Data 2023',
        description: 'Complete sales transaction data',
        rowCount: 150000,
        createdAt: '2023-01-01T00:00:00Z',
        connectionString: 'secret-connection', // 항상 제외됨
        apiKey: 'secret-api-key', // 항상 제외됨
        source: {
          type: 'mysql',
          name: 'production_db',
          connectionDetails: 'secret-details', // 허용되지 않음
        },
        columns: [
          {
            name: 'transaction_id',
            type: 'INTEGER',
            nullable: false,
            internalMetadata: 'secret', // 허용되지 않음
          },
          {
            name: 'customer_name',
            type: 'VARCHAR',
            nullable: true,
          },
          {
            name: 'amount',
            type: 'DECIMAL',
            nullable: false,
          },
        ],
        // 실제 데이터는 매우 클 수 있음 (필드 선택으로 제외)
        actualData: {
          rows: Array(150000).fill({
            transaction_id: 1,
            customer_name: 'Customer',
            amount: 100.5,
          }),
        },
      },
    ];

    return datasets;
  }

  @NoFieldSelection() // 필드 선택 비활성화
  @Get('public-data')
  async getPublicData(@Query('fields') fields?: string) {
    return {
      message: 'This endpoint ignores field selection',
      fieldsRequested: fields || 'none',
      data: {
        public: true,
        alwaysIncluded: 'all fields',
        timestamp: new Date().toISOString(),
      },
    };
  }

  @FieldSelection()
  @Get('performance-test')
  async getPerformanceTest(@Query('fields') fields?: string, @Query('size') size?: string) {
    const itemCount = parseInt(size || '100');

    // 성능 테스트용 대용량 데이터 생성
    const largeData = {
      metadata: {
        totalItems: itemCount,
        generatedAt: new Date().toISOString(),
        estimatedSizeKB: (itemCount * 0.5).toFixed(2),
      },
      items: Array(itemCount)
        .fill(null)
        .map((_, index) => ({
          id: index + 1,
          name: `Item ${index + 1}`,
          description: `This is a detailed description for item ${index + 1}. `.repeat(5),
          category: `Category ${Math.floor(index / 10) + 1}`,
          price: Math.round(Math.random() * 1000 * 100) / 100,
          createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            tags: ['tag1', 'tag2', 'tag3'],
            ratings: Array(5)
              .fill(null)
              .map(() => Math.floor(Math.random() * 5) + 1),
            reviews: Array(3)
              .fill(null)
              .map((_, i) => ({
                id: i + 1,
                text: `Review text ${i + 1} with detailed feedback. `.repeat(3),
                author: `User ${i + 1}`,
                date: new Date().toISOString(),
              })),
          },
          largeContent: {
            // 큰 데이터 블록 (필드 선택으로 제외 가능)
            content: 'Large content block. '.repeat(100),
            attachments: Array(10)
              .fill(null)
              .map((_, i) => ({
                id: i + 1,
                filename: `file${i + 1}.pdf`,
                size: Math.floor(Math.random() * 1000000),
                data: 'binary-data-placeholder',
              })),
          },
        })),
    };

    return largeData;
  }

  @Get('field-selection-info')
  async getFieldSelectionInfo() {
    return {
      fieldSelectionFeature: {
        version: '1.0.0',
        description: 'GraphQL-style field selection for REST APIs',
        usage: {
          basicSelection: '?fields=id,name,email',
          nestedSelection: '?fields=id,name,profile.avatar,profile.bio',
          arraySelection: '?fields=id,title,widgets.id,widgets.name',
        },
        features: [
          'Field whitelisting for security',
          'Automatic exclusion of sensitive fields',
          'Nested object field selection',
          'Array element field selection',
          'Query optimization (TypeORM/Knex)',
          'Performance monitoring and metrics',
        ],
        benefits: [
          'Reduced network bandwidth usage',
          'Faster API response times',
          'Improved mobile app performance',
          'Better caching efficiency',
          'Enhanced security (no sensitive data exposure)',
        ],
        examples: {
          '/test-fields/users?fields=id,name,email': 'Basic user info only',
          '/test-fields/users?fields=id,name,profile.avatar': 'User with avatar',
          '/test-fields/dashboards?fields=id,title,widgets.id,widgets.name':
            'Dashboard with widget summary',
          '/test-fields/datasets?fields=id,name,columns.name,columns.type': 'Dataset schema only',
        },
      },
    };
  }
}
