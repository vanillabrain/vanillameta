// Artillery 프로세서 - 테스트 시나리오를 위한 헬퍼 함수들

module.exports = {
  // 사용자 인증 함수
  authenticateUser: async function(context, events, done) {
    const request = require('request');
    
    const options = {
      url: `${context.vars.target || 'http://localhost:3000'}/api/auth/login`,
      method: 'POST',
      json: true,
      body: {
        userId: context.vars.userId || 'testuser',
        password: context.vars.password || 'testpassword123'
      }
    };
    
    request(options, (error, response, body) => {
      if (error) {
        return done(error);
      }
      
      if (response.statusCode === 201 && body.accessToken) {
        context.vars.accessToken = body.accessToken;
        context.vars.refreshToken = body.refreshToken;
        context.vars.userId = body.user.id;
        return done();
      }
      
      return done(new Error(`Authentication failed: ${response.statusCode}`));
    });
  },

  // 랜덤 테스트 데이터 생성
  generateTestData: function(context, events, done) {
    context.vars.randomData = {
      dashboardTitle: `Performance Test Dashboard ${Date.now()}`,
      widgetName: `Test Widget ${Math.random().toString(36).substring(7)}`,
      query: generateRandomQuery(),
      chartType: ['bar', 'line', 'pie', 'scatter'][Math.floor(Math.random() * 4)],
      dataPoints: generateDataPoints(100)
    };
    
    return done();
  },

  // 대시보드 ID 선택 (기존 대시보드에서 랜덤 선택)
  selectDashboard: async function(context, events, done) {
    const request = require('request');
    
    const options = {
      url: `${context.vars.target || 'http://localhost:3000'}/api/dashboard`,
      method: 'GET',
      json: true,
      headers: {
        'Authorization': `Bearer ${context.vars.accessToken}`
      }
    };
    
    request(options, (error, response, body) => {
      if (error) {
        return done(error);
      }
      
      if (response.statusCode === 200 && body.data && body.data.length > 0) {
        const randomIndex = Math.floor(Math.random() * body.data.length);
        context.vars.selectedDashboardId = body.data[randomIndex].id;
        return done();
      }
      
      // 대시보드가 없으면 기본값 사용
      context.vars.selectedDashboardId = 1;
      return done();
    });
  },

  // 응답 시간 기록
  recordResponseTime: function(requestParams, response, context, events, done) {
    if (response.timings) {
      const totalTime = response.timings.end - response.timings.start;
      console.log(`[${new Date().toISOString()}] ${requestParams.url} - ${totalTime}ms`);
      
      // 느린 요청 기록
      if (totalTime > 3000) {
        console.warn(`SLOW REQUEST: ${requestParams.url} took ${totalTime}ms`);
      }
    }
    
    return done();
  },

  // 에러 핸들링
  handleErrors: function(requestParams, response, context, events, done) {
    if (response.statusCode >= 400) {
      console.error(`ERROR: ${requestParams.url} returned ${response.statusCode}`);
      
      // 인증 에러인 경우 재인증 시도
      if (response.statusCode === 401) {
        context.vars.needsReauth = true;
      }
    }
    
    return done();
  },

  // 테스트 데이터 정리
  cleanupTestData: async function(context, events, done) {
    const request = require('request');
    
    // 생성된 테스트 데이터 ID들을 수집
    const itemsToDelete = [];
    
    if (context.vars.createdDashboardIds) {
      itemsToDelete.push(...context.vars.createdDashboardIds.map(id => ({
        type: 'dashboard',
        id: id
      })));
    }
    
    if (context.vars.createdWidgetIds) {
      itemsToDelete.push(...context.vars.createdWidgetIds.map(id => ({
        type: 'widget',
        id: id
      })));
    }
    
    // 병렬로 삭제 요청 실행
    const deletePromises = itemsToDelete.map(item => {
      return new Promise((resolve, reject) => {
        const options = {
          url: `${context.vars.target || 'http://localhost:3000'}/api/${item.type}/${item.id}`,
          method: 'DELETE',
          json: true,
          headers: {
            'Authorization': `Bearer ${context.vars.accessToken}`
          }
        };
        
        request(options, (error, response, body) => {
          if (error) {
            console.error(`Failed to delete ${item.type} ${item.id}:`, error);
          }
          resolve(); // 에러가 있어도 계속 진행
        });
      });
    });
    
    await Promise.all(deletePromises);
    return done();
  },

  // 메트릭 수집
  collectMetrics: function(requestParams, response, context, events, done) {
    // 응답 크기 계산
    const responseSize = JSON.stringify(response.body || '').length;
    
    // 메트릭 저장
    if (!context.vars.metrics) {
      context.vars.metrics = {
        totalRequests: 0,
        totalResponseSize: 0,
        errorCount: 0,
        slowRequests: 0
      };
    }
    
    context.vars.metrics.totalRequests++;
    context.vars.metrics.totalResponseSize += responseSize;
    
    if (response.statusCode >= 400) {
      context.vars.metrics.errorCount++;
    }
    
    if (response.timings && (response.timings.end - response.timings.start) > 3000) {
      context.vars.metrics.slowRequests++;
    }
    
    return done();
  }
};

// 헬퍼 함수들

function generateRandomQuery() {
  const queries = [
    "SELECT id, name, value FROM test_table WHERE active = 1",
    "SELECT COUNT(*) as total, category FROM data GROUP BY category",
    "SELECT * FROM metrics WHERE date >= '2024-01-01' ORDER BY date DESC",
    "SELECT AVG(value) as avg_value, MAX(value) as max_value FROM measurements",
    "SELECT DISTINCT user_id, action FROM user_logs LIMIT 100"
  ];
  
  return queries[Math.floor(Math.random() * queries.length)];
}

function generateDataPoints(count) {
  const data = [];
  const startDate = new Date('2024-01-01');
  
  for (let i = 0; i < count; i++) {
    data.push({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      value: Math.floor(Math.random() * 1000),
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
    });
  }
  
  return data;
}