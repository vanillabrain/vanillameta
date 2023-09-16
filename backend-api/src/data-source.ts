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
  database: configNodeenv == 'local' ? 'sqlite.db' : configService.get<string>('DB_NAME'),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: configNodeenv != 'prod',
  logging: configNodeenv != 'prod',
};

export default new DataSource(dataSourceOptions);
