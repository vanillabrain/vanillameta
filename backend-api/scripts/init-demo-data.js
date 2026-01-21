#!/usr/bin/env node

/**
 * 데모 데이터 초기화 스크립트
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

console.log('🌱 Initializing demo data...\n');

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new sqlite3.Database(dbPath);

// SHA512 해시 함수
function sha512(text) {
  return crypto.createHash('sha512').update(text).digest('hex');
}

// 트랜잭션 시작
db.serialize(() => {
  // 1. 데모 사용자 생성
  db.get("SELECT COUNT(*) as count FROM user WHERE email = 'demo@example.com'", (err, result) => {
    if (err || result.count > 0) {
      console.log('ℹ️  Demo user already exists');
      return;
    }
    
    const password = sha512('demo123');
    db.run(
      "INSERT INTO user (userId, email, password, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
      ['demo-user', 'demo@example.com', password],
      function(err) {
        if (err) {
          console.error('❌ Failed to create demo user:', err.message);
        } else {
          console.log('✅ Demo user created (email: demo@example.com, password: demo123)');
        }
      }
    );
  });
  
  // 2. DatabaseType 데이터 확인 및 생성
  db.get("SELECT COUNT(*) as count FROM databaseType WHERE engine = 'sqlite'", (err, result) => {
    if (err || result.count > 0) {
      console.log('ℹ️  SQLite database type already exists');
      return;
    }
    
    db.run(
      "INSERT INTO databaseType (type, engine, title, seq, useYn) VALUES (?, ?, ?, ?, ?)",
      ['sqlite', 'sqlite', 'SQLite', 1, 'Y'],
      function(err) {
        if (err) {
          console.error('❌ Failed to create SQLite type:', err.message);
        } else {
          console.log('✅ SQLite database type created');
        }
      }
    );
  });
  
  // 3. 데모 데이터베이스 연결 생성
  db.get("SELECT COUNT(*) as count FROM database WHERE name = 'Demo SQLite DB'", (err, result) => {
    if (err || result.count > 0) {
      console.log('ℹ️  Demo database connection already exists');
      return;
    }
    
    const connectionConfig = JSON.stringify({
      client: 'sqlite',
      connection: {
        filename: ':memory:'
      },
      useNullAsDefault: true
    });
    
    db.run(
      "INSERT INTO database (name, description, connectionConfig, engine, type, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
      ['Demo SQLite DB', 'In-memory SQLite for demo', connectionConfig, 'sqlite', 'sqlite', 'Asia/Seoul'],
      function(err) {
        if (err) {
          console.error('❌ Failed to create demo database:', err.message);
        } else {
          console.log('✅ Demo database connection created');
        }
      }
    );
  });
  
  // 4. 샘플 대시보드 생성
  db.get("SELECT COUNT(*) as count FROM dashboard WHERE title = 'Demo Dashboard'", (err, result) => {
    if (err || result.count > 0) {
      console.log('ℹ️  Demo dashboard already exists');
      return;
    }
    
    db.run(
      "INSERT INTO dashboard (title, delYn, createdAt, updatedAt) VALUES (?, ?, datetime('now'), datetime('now'))",
      ['Demo Dashboard', 'N'],
      function(err) {
        if (err) {
          console.error('❌ Failed to create demo dashboard:', err.message);
        } else {
          console.log('✅ Demo dashboard created');
        }
      }
    );
  });
  
  // 5. 기본 컴포넌트 확인
  db.all("SELECT COUNT(*) as count FROM component", (err, result) => {
    if (!err && result[0].count === 0) {
      console.log('⚠️  No chart components found. They will be loaded on server start.');
    } else if (!err) {
      console.log(`ℹ️  Found ${result[0].count} chart components`);
    }
  });
  
  // 완료 메시지
  setTimeout(() => {
    console.log('\n🎉 Demo data initialization completed!');
    console.log('\n📝 Login credentials:');
    console.log('   Email: demo@example.com');
    console.log('   Password: demo123\n');
    db.close();
  }, 1000);
});