#!/usr/bin/env ts-node

/**
 * 데이터베이스별 최적화 테스트 스크립트
 * 각 데이터베이스별로 최적화 설정이 올바르게 적용되는지 테스트합니다.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseOptimizerFactory } from '../src/connection/optimizers/database-optimizer.factory';
import { getDatabaseSpecificConfig, getSupportedDatabaseTypes } from '../src/connection/database-specific.config';
import { DatabaseFeature } from '../src/connection/optimizers/database-optimizer.interface';

interface TestResult {
  databaseType: string;
  hasOptimizer: boolean;
  hasSpecificConfig: boolean;
  batchSize: number;
  maxConnections: number;
  features: any;
  performanceHints: number;
  configTest: {
    connectionConfig: boolean;
    poolSettings: boolean;
    clientSettings: boolean;
  };
}

async function testDatabaseOptimizations() {
  console.log('🚀 Starting Database Optimization Tests...\n');

  try {
    // NestJS 애플리케이션 부트스트랩
    const app = await NestFactory.createApplicationContext(AppModule);
    const optimizerFactory = app.get(DatabaseOptimizerFactory);

    console.log('📊 Testing Database Optimizations:\n');

    const testResults: TestResult[] = [];
    const supportedTypes = getSupportedDatabaseTypes();

    for (const databaseType of supportedTypes) {
      console.log(`\n🔍 Testing ${databaseType.toUpperCase()}:`);
      
      const result: TestResult = {
        databaseType,
        hasOptimizer: false,
        hasSpecificConfig: false,
        batchSize: 0,
        maxConnections: 0,
        features: {},
        performanceHints: 0,
        configTest: {
          connectionConfig: false,
          poolSettings: false,
          clientSettings: false,
        },
      };

      // 옵티마이저 테스트
      const optimizer = optimizerFactory.getOptimizer(databaseType);
      if (optimizer) {
        result.hasOptimizer = true;
        result.batchSize = optimizer.getBatchSize();
        result.performanceHints = optimizer.getPerformanceHints().length;
        
        // 기능 지원 테스트
        const features = Object.values(DatabaseFeature);
        result.features = features.reduce((acc, feature) => {
          acc[feature] = optimizer.supportsFeature(feature);
          return acc;
        }, {} as any);

        console.log(`  ✅ Optimizer: ${optimizer.databaseType}`);
        console.log(`  📦 Batch Size: ${result.batchSize}`);
        console.log(`  💡 Performance Hints: ${result.performanceHints}`);
        console.log(`  🛠️  Supported Features: ${Object.values(result.features).filter(Boolean).length}/${features.length}`);
      } else {
        console.log(`  ❌ No optimizer found`);
      }

      // DB별 특화 설정 테스트
      const dbConfig = getDatabaseSpecificConfig(databaseType);
      if (dbConfig) {
        result.hasSpecificConfig = true;
        result.maxConnections = dbConfig.performanceSettings.maxConnections;

        // 설정 유효성 검증
        result.configTest.connectionConfig = !!dbConfig.connectionConfig;
        result.configTest.poolSettings = !!dbConfig.connectionConfig.pool;
        result.configTest.clientSettings = !!dbConfig.connectionConfig.connection;

        console.log(`  ✅ Specific Config: Available`);
        console.log(`  🔗 Max Connections: ${result.maxConnections}`);
        console.log(`  ⚙️  Config Valid: ${Object.values(result.configTest).every(Boolean) ? 'Yes' : 'No'}`);
      } else {
        console.log(`  ❌ No specific config found`);
      }

      // 연결 설정 최적화 테스트
      try {
        const baseConfig = {
          client: databaseType,
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            user: 'test',
            password: 'test',
          },
        };

        const optimizedConfig = optimizerFactory.getOptimizedConnectionConfig(databaseType, baseConfig);
        
        if (optimizedConfig && optimizedConfig.pool) {
          console.log(`  ✅ Connection Optimization: Applied`);
          console.log(`  🏊 Pool Min/Max: ${optimizedConfig.pool.min}/${optimizedConfig.pool.max}`);
        } else {
          console.log(`  ⚠️  Connection Optimization: Basic fallback`);
        }
      } catch (error) {
        console.log(`  ❌ Connection Optimization: Failed - ${error.message}`);
      }

      testResults.push(result);
    }

    // 전체 결과 요약
    console.log('\n📈 OPTIMIZATION TEST SUMMARY:');
    console.log('=' .repeat(60));
    
    const optimizedDbs = testResults.filter(r => r.hasOptimizer).length;
    const configuredDbs = testResults.filter(r => r.hasSpecificConfig).length;
    
    console.log(`Total Databases Tested: ${testResults.length}`);
    console.log(`Databases with Optimizers: ${optimizedDbs}/${testResults.length}`);
    console.log(`Databases with Specific Config: ${configuredDbs}/${testResults.length}`);
    console.log(`Coverage: ${Math.round((optimizedDbs / testResults.length) * 100)}%`);

    // 상세 결과 테이블
    console.log('\n📊 DETAILED RESULTS:');
    console.table(testResults.map(r => ({
      Database: r.databaseType,
      Optimizer: r.hasOptimizer ? '✅' : '❌',
      Config: r.hasSpecificConfig ? '✅' : '❌',
      'Batch Size': r.batchSize || 'N/A',
      'Max Conn': r.maxConnections || 'N/A',
      'Hints': r.performanceHints || 0,
      'Features': Object.values(r.features).filter(Boolean).length || 0,
    })));

    // 기능별 지원 현황
    console.log('\n🛠️  FEATURE SUPPORT MATRIX:');
    const featureMatrix = Object.values(DatabaseFeature).map(feature => {
      const support = testResults.reduce((acc, result) => {
        if (result.features[feature]) {
          acc.push(result.databaseType);
        }
        return acc;
      }, [] as string[]);
      
      return {
        Feature: feature,
        'Supported DBs': support.length,
        'Database Types': support.join(', ') || 'None',
      };
    });
    
    console.table(featureMatrix);

    // 성능 힌트 상위 데이터베이스
    console.log('\n💡 TOP DATABASES BY PERFORMANCE HINTS:');
    const topPerformers = testResults
      .filter(r => r.performanceHints > 0)
      .sort((a, b) => b.performanceHints - a.performanceHints)
      .slice(0, 5);
    
    topPerformers.forEach((db, index) => {
      console.log(`${index + 1}. ${db.databaseType}: ${db.performanceHints} hints`);
    });

    // 권장사항
    console.log('\n🎯 RECOMMENDATIONS:');
    testResults.forEach(result => {
      if (!result.hasOptimizer) {
        console.log(`⚠️  Consider implementing optimizer for ${result.databaseType}`);
      }
      if (!result.hasSpecificConfig) {
        console.log(`⚠️  Consider adding specific config for ${result.databaseType}`);
      }
    });

    if (optimizedDbs === testResults.length) {
      console.log('🎉 All databases are fully optimized!');
    }

    await app.close();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 특정 데이터베이스 상세 테스트
async function testSpecificDatabase(databaseType: string) {
  console.log(`🔍 Detailed test for ${databaseType.toUpperCase()}:\n`);

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const optimizerFactory = app.get(DatabaseOptimizerFactory);

    const optimizer = optimizerFactory.getOptimizer(databaseType);
    const dbConfig = getDatabaseSpecificConfig(databaseType);

    if (optimizer) {
      console.log('📝 Performance Hints:');
      const hints = optimizer.getPerformanceHints();
      hints.forEach((hint, index) => {
        console.log(`${index + 1}. [${hint.category.toUpperCase()}] ${hint.description}`);
        console.log(`   Priority: ${hint.priority}`);
        console.log(`   Implementation: ${hint.implementation}`);
        console.log('');
      });

      console.log('🛠️  Supported Features:');
      Object.values(DatabaseFeature).forEach(feature => {
        const supported = optimizer.supportsFeature(feature);
        console.log(`  ${supported ? '✅' : '❌'} ${feature}`);
      });
    }

    if (dbConfig) {
      console.log('\n⚙️  Configuration Details:');
      console.log(`  Batch Size: ${dbConfig.performanceSettings.batchSize}`);
      console.log(`  Query Timeout: ${dbConfig.performanceSettings.queryTimeout}ms`);
      console.log(`  Connection Timeout: ${dbConfig.performanceSettings.connectionTimeout}ms`);
      console.log(`  Max Connections: ${dbConfig.performanceSettings.maxConnections}`);
      
      console.log('\n🎯 Optimization Strategy:');
      console.log(`  Preferred Join Type: ${dbConfig.optimizationHints.preferredJoinType}`);
      console.log(`  Index Strategy: ${dbConfig.optimizationHints.indexStrategy}`);
      console.log(`  Partition Strategy: ${dbConfig.optimizationHints.partitionStrategy}`);
    }

    await app.close();

  } catch (error) {
    console.error('❌ Detailed test failed:', error);
    process.exit(1);
  }
}

// 메인 실행
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] !== 'all') {
    await testSpecificDatabase(args[0]);
  } else {
    await testDatabaseOptimizations();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { testDatabaseOptimizations, testSpecificDatabase };