import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserStatus } from '../../user/entities/user.entity';
import { DatabaseType } from '../../database/entities/database_type.entity';
import { Component } from '../../component/entities/component.entity';
import { CustomLoggerService } from '../logger/logger.service';
import CreateInitialData from '../../database/seeds/create-initial-data';
import * as crypto from 'crypto';

@Injectable()
export class InitializationService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(DatabaseType)
    private readonly databaseTypeRepository: Repository<DatabaseType>,
    @InjectRepository(Component)
    private readonly componentRepository: Repository<Component>,
    private readonly logger: CustomLoggerService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'local') {
      await this.initializeLocalData();
    }
  }

  private async initializeLocalData() {
    try {
      // 1. create-initial-data.ts 실행 (Components, DatabaseTypes, Templates, TemplateItems, Guest user)
      const initialDataSeeder = new CreateInitialData();
      await initialDataSeeder.run(this.dataSource);
      this.logger.log('✅ Initial data seeded from create-initial-data.ts', 'InitializationService');
      
      // 2. 기본 관리자 사용자 생성
      const adminExists = await this.userRepository.findOne({
        where: { email: 'admin@example.com' },
      });

      if (!adminExists) {
        const hashedPassword = crypto.createHash('sha512').update('Admin!@12').digest('hex');
        await this.userRepository.save({
          userId: 'admin',
          email: 'admin@example.com',
          password: hashedPassword,
          status: UserStatus.ACTIVE,
        });
        this.logger.log(
          '✅ Default admin user created (admin@example.com / Admin!@12)',
          'InitializationService',
        );
      }


      this.logger.log('🎉 Local environment initialization completed', 'InitializationService');
    } catch (error) {
      this.logger.error('Failed to initialize local data', error, 'InitializationService');
    }
  }
}
