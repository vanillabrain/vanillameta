import 'reflect-metadata';
import { DataSource } from 'typeorm';
import CreateInitialData from './database/seeds/create-initial-data';

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: `${__dirname}/../sqlite.db`,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: true,
});

async function runSeeds() {
  try {
    console.log('🌱 Initializing data source...');
    await AppDataSource.initialize();
    
    console.log('🌱 Running seeds...');
    const seeder = new CreateInitialData();
    await seeder.run(AppDataSource);
    
    console.log('✅ Seeds completed successfully!');
  } catch (error) {
    console.error('❌ Error running seeds:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

runSeeds();