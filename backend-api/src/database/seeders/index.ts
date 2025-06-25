import { DataSource } from 'typeorm';
import { seedComponents } from './component.seeder';

export async function runSeeders(dataSource: DataSource) {
  console.log('Starting database seeding...');
  
  try {
    // 컴포넌트 시더 실행
    await seedComponents(dataSource);
    
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error during database seeding:', error);
    throw error;
  }
}