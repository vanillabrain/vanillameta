import {TypeOrmModuleOptions} from '@nestjs/typeorm';

import * as dotenv from 'dotenv'; // 무조건 상대경로로 가져와야 시딩됨

dotenv.config();

const config: TypeOrmModuleOptions = {
    type: 'sqlite',
    database: 'sqlite.db',
    autoLoadEntities: true,
    entities: ['src/**/*.entity{.ts,.js}', 'src/**/*.enum{.ts,.js}'],
    synchronize: true,          // 자동으로 테이블 생성, 한번 작동 후 false
    retryAttempts: 1,
    logging: true,
    keepConnectionAlive: true,
};

export = config;