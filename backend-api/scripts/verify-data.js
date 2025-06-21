#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verifying demo data...\n');

db.serialize(() => {
  // Check users
  db.get("SELECT COUNT(*) as count FROM user WHERE email = 'demo@example.com'", (err, result) => {
    if (!err) {
      console.log(`✅ Demo users: ${result.count}`);
    }
  });
  
  // Check database types
  db.get("SELECT COUNT(*) as count FROM databaseType WHERE engine = 'sqlite'", (err, result) => {
    if (!err) {
      console.log(`✅ SQLite database types: ${result.count}`);
    }
  });
  
  // Check databases
  db.get("SELECT COUNT(*) as count FROM database", (err, result) => {
    if (!err) {
      console.log(`✅ Database connections: ${result.count}`);
    }
  });
  
  // Check dashboards
  db.get("SELECT COUNT(*) as count FROM dashboard", (err, result) => {
    if (!err) {
      console.log(`✅ Dashboards: ${result.count}`);
    }
  });
  
  // Check components
  db.get("SELECT COUNT(*) as count FROM component", (err, result) => {
    if (!err) {
      console.log(`✅ Chart components: ${result.count}`);
    }
  });
  
  setTimeout(() => {
    db.close();
  }, 500);
});