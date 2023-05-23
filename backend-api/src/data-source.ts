import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

const configService = new ConfigService();

export default new DataSource({
    type: 'sqlite',
    database: 'sqlite.db',
    synchronize: true,
    entities: ['src/**/*.entity{.ts,.js}', 'src/**/*.enum{.ts,.js}'],
    logging: true,
});