#!/usr/bin/env node

/**
 * SQLite 연결 테스트 스크립트
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing SQLite setup...\n');

const dbPath = path.join(__dirname, '..', 'sqlite.db');

// 데이터베이스 파일 확인
if (fs.existsSync(dbPath)) {
  console.log(`✅ Database file exists: ${dbPath}`);
  console.log(`   Size: ${(fs.statSync(dbPath).size / 1024).toFixed(2)} KB\n`);
} else {
  console.log(`⚠️  Database file not found: ${dbPath}`);
  console.log('   It will be created on first run.\n');
}

// SQLite 연결 테스트
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite connection failed:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Connected to SQLite database\n');
  
  // 테이블 목록 확인
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('❌ Failed to list tables:', err.message);
      db.close();
      process.exit(1);
    }
    
    console.log(`📊 Found ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`   - ${table.name}`);
    });
    
    // users 테이블 확인
    if (tables.some(t => t.name === 'users')) {
      db.get("SELECT COUNT(*) as count FROM users", (err, result) => {
        if (!err) {
          console.log(`\n👥 Users table has ${result.count} records`);
        }
        
        // database 테이블 확인
        db.get("SELECT COUNT(*) as count FROM database WHERE engine = 'sqlite'", (err, result) => {
          if (!err && result) {
            console.log(`💾 SQLite connections: ${result.count}`);
          }
          
          console.log('\n✅ SQLite test completed successfully!');
          db.close();
        });
      });
    } else {
      console.log('\n⚠️  Users table not found. Database might need initialization.');
      db.close();
    }
  });
});