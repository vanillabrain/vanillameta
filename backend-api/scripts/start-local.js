#!/usr/bin/env node

/**
 * SQLite 로컬 환경 시작 스크립트
 * node_modules 문제를 우회하여 직접 서버 시작
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting VanillaMeta Backend in local SQLite mode...\n');

// 환경 변수 설정
process.env.NODE_ENV = 'local';
process.env.DB_TYPE = 'sqlite';

// SQLite 데이터베이스 파일 확인
const dbPath = path.join(__dirname, '..', 'sqlite.db');
if (!fs.existsSync(dbPath)) {
  console.log('⚠️  SQLite database file not found. It will be created on first run.');
}

// TypeScript 컴파일
console.log('📦 Compiling TypeScript...');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation check passed\n');
} catch (error) {
  console.error('❌ TypeScript compilation failed. Continuing anyway...\n');
}

// 서버 시작
console.log('🎯 Starting NestJS server...');
console.log('📍 Environment: local');
console.log('📍 Database: SQLite (sqlite.db)');
console.log('📍 Port: 3000\n');

// nest start 명령 직접 실행
try {
  execSync('cross-env NODE_ENV=local npx nest start', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}