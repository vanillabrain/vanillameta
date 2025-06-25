import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { seedDemoData, createDemoSalesTable } from './database/seeds/demo-data.seed';
import { User, UserStatus } from './user/entities/user.entity';
import * as crypto from 'crypto';
import CreateInitialData from './database/seeds/create-initial-data';

async function runSeed() {
  console.log('🌱 Starting seed process...');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);

    // 기본 관리자 사용자 생성
    const userRepo = dataSource.getRepository(User);

    // admin 사용자 확인 및 생성
    let adminUser = await userRepo.findOne({ where: { email: 'admin@example.com' } });
    if (!adminUser) {
      const hashedPassword = crypto.createHash('sha512').update('Admin!@12').digest('hex');
      adminUser = await userRepo.save({
        userId: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        status: UserStatus.ACTIVE,
      });
      console.log('✅ Admin user created');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // 초기 데이터 시더 실행 (components, database types, templates 등)
    const initialDataSeeder = new CreateInitialData();
    await initialDataSeeder.run(dataSource);
    console.log('✅ Initial data seeded');
    
    // 데모 데이터 생성
    await seedDemoData(dataSource);

    console.log('🎉 Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSeed();
