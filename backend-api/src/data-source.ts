import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

config();

const configService = new ConfigService();
const configNodeenv = configService.get<string>('NODE_ENV');

const dataSourceOptions: DataSourceOptions = {
  type: configNodeenv == 'local' ? 'sqlite' : 'mysql',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configNodeenv == 'local' ? './sqlite_data/sqlite.db' : configService.get<string>('DB_NAME'),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: configNodeenv != 'prod',
  logging: configNodeenv != 'prod',
  // Lambda 환경에 최적화된 연결 풀 설정
  ...(configNodeenv !== 'local' && {
    extra: {
      // 연결 풀 크기 설정
      connectionLimit: parseInt(configService.get<string>('DB_CONNECTION_LIMIT')) || 5,

      // 타임아웃 설정
      connectTimeout: 30000,
      acquireTimeout: 30000,
      timeout: 30000,

      // 연결 유지 설정
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,

      // 재시도 설정
      waitForConnections: true,
      queueLimit: 0,
    },
  }),
};

export default new DataSource(dataSourceOptions);