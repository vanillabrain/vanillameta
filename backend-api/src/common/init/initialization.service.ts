import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { DatabaseType } from '../../database/entities/database_type.entity';
import { CustomLoggerService } from '../logger/logger.service';
import * as crypto from 'crypto';

@Injectable()
export class InitializationService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(DatabaseType)
    private readonly databaseTypeRepository: Repository<DatabaseType>,
    private readonly logger: CustomLoggerService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'local') {
      await this.initializeLocalData();
    }
  }

  private async initializeLocalData() {
    try {
      // 1. 기본 관리자 사용자 생성
      const adminExists = await this.userRepository.findOne({
        where: { email: 'admin@example.com' },
      });

      if (!adminExists) {
        const hashedPassword = crypto.createHash('sha512').update('admin123').digest('hex');
        await this.userRepository.save({
          userId: 'admin',
          email: 'admin@example.com',
          password: hashedPassword,
        });
        this.logger.log('✅ Default admin user created (admin@example.com / admin123)', 'InitializationService');
      }

      // 2. SQLite 데이터베이스 타입 생성
      const sqliteExists = await this.databaseTypeRepository.findOne({
        where: { engine: 'sqlite' },
      });

      if (!sqliteExists) {
        await this.databaseTypeRepository.save({
          type: 'sqlite',
          engine: 'sqlite',
          title: 'SQLite',
          seq: 1,
          useYn: 'Y',
        });
        this.logger.log('✅ SQLite database type created', 'InitializationService');
      }

      // 3. 기타 데이터베이스 타입 생성
      const dbTypes = [
        { type: 'mysql', engine: 'mysql', title: 'MySQL', seq: 2 },
        { type: 'postgresql', engine: 'postgresql', title: 'PostgreSQL', seq: 3 },
        { type: 'mariadb', engine: 'mariadb', title: 'MariaDB', seq: 4 },
      ];

      for (const dbType of dbTypes) {
        const exists = await this.databaseTypeRepository.findOne({
          where: { engine: dbType.engine },
        });

        if (!exists) {
          await this.databaseTypeRepository.save({
            ...dbType,
            useYn: 'Y',
          });
          this.logger.log(`✅ ${dbType.title} database type created`, 'InitializationService');
        }
      }

      this.logger.log('🎉 Local environment initialization completed', 'InitializationService');
    } catch (error) {
      this.logger.error('Failed to initialize local data', error, 'InitializationService');
    }
  }
}