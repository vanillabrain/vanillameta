#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking users table structure...\n');

db.all("PRAGMA table_info(users)", (err, columns) => {
  if (err) {
    console.error('Error:', err.message);
    return;
  }
  
  console.log('Users table columns:');
  columns.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
  });
  
  console.log('\nChecking user table structure...\n');
  
  db.all("PRAGMA table_info(user)", (err, columns) => {
    if (err) {
      console.error('Error:', err.message);
      db.close();
      return;
    }
    
    console.log('User table columns:');
    columns.forEach(col => {
      console.log(`  ${col.name} (${col.type})`);
    });
    
    db.close();
  });
});