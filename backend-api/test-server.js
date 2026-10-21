/**
 * 간단한 Express 서버로 SQLite 환경 테스트
 */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database
const dbPath = path.join(__dirname, 'sqlite.db');
const db = new sqlite3.Database(dbPath);

// SHA512 해시
function sha512(text) {
  return crypto.createHash('sha512').update(text).digest('hex');
}

// Health check
app.get('/v1/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    environment: 'local',
    database: 'SQLite',
    timestamp: new Date().toISOString()
  });
});

// Login
app.post('/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      status: 'ERROR', 
      message: 'Email and password required' 
    });
  }
  
  const hashedPassword = sha512(password);
  
  db.get(
    "SELECT id, userId, email FROM user WHERE email = ? AND password = ?",
    [email, hashedPassword],
    (err, user) => {
      if (err) {
        return res.status(500).json({ 
          status: 'ERROR', 
          message: 'Database error' 
        });
      }
      
      if (!user) {
        return res.status(401).json({ 
          status: 'ERROR', 
          message: 'Invalid credentials' 
        });
      }
      
      // Generate fake JWT token
      const token = Buffer.from(JSON.stringify({
        userId: user.userId,
        email: user.email,
        exp: Date.now() + 3600000
      })).toString('base64');
      
      res.json({
        status: 'SUCCESS',
        data: {
          accessToken: token,
          refreshToken: token + '_refresh',
          user: {
            id: user.id,
            userId: user.userId,
            email: user.email
          }
        }
      });
    }
  );
});

// Dashboard list
app.get('/v1/dashboard', (req, res) => {
  db.all(
    "SELECT * FROM dashboard WHERE delYn = 'N' ORDER BY id DESC",
    (err, dashboards) => {
      if (err) {
        return res.status(500).json({ 
          status: 'ERROR', 
          message: 'Database error' 
        });
      }
      
      res.json({
        status: 'SUCCESS',
        data: dashboards || []
      });
    }
  );
});

// Widget list
app.get('/v1/widget', (req, res) => {
  db.all(
    "SELECT * FROM widget ORDER BY id DESC",
    (err, widgets) => {
      if (err) {
        return res.status(500).json({ 
          status: 'ERROR', 
          message: 'Database error' 
        });
      }
      
      res.json({
        status: 'SUCCESS',
        data: widgets || []
      });
    }
  );
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Test server running at http://localhost:${port}`);
  console.log(`📍 Environment: local (SQLite)`);
  console.log(`\n🧪 Test endpoints:`);
  console.log(`   GET  http://localhost:${port}/v1/health`);
  console.log(`   POST http://localhost:${port}/v1/auth/login`);
  console.log(`   GET  http://localhost:${port}/v1/dashboard`);
  console.log(`   GET  http://localhost:${port}/v1/widget`);
  console.log(`\n📝 Demo credentials:`);
  console.log(`   Email: demo@example.com`);
  console.log(`   Password: demo123\n`);
});