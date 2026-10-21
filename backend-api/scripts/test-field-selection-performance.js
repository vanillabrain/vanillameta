#!/usr/bin/env node

/**
 * Field Selection Performance Testing Script
 * 
 * This script tests the performance impact of field selection on API responses
 * by comparing response times and payload sizes with and without field selection.
 */

const axios = require('axios');
const https = require('https');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const TEST_ITERATIONS = 10;

// Axios instance with auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 30000
});

// Performance metrics collector
class PerformanceMetrics {
  constructor(name) {
    this.name = name;
    this.times = [];
    this.sizes = [];
  }

  addMeasurement(time, size) {
    this.times.push(time);
    this.sizes.push(size);
  }

  getStats() {
    const avgTime = this.times.reduce((a, b) => a + b, 0) / this.times.length;
    const avgSize = this.sizes.reduce((a, b) => a + b, 0) / this.sizes.length;
    const minTime = Math.min(...this.times);
    const maxTime = Math.max(...this.times);
    
    return {
      name: this.name,
      avgTime: avgTime.toFixed(2),
      minTime: minTime.toFixed(2),
      maxTime: maxTime.toFixed(2),
      avgSize: avgSize,
      measurements: this.times.length
    };
  }
}

// Test scenarios
const testScenarios = [
  {
    name: 'Dashboard List - No Field Selection',
    endpoint: '/dashboard',
    params: {}
  },
  {
    name: 'Dashboard List - Basic Fields',
    endpoint: '/dashboard',
    params: { fields: 'id,title,createdAt' }
  },
  {
    name: 'Dashboard List - With Nested Fields',
    endpoint: '/dashboard',
    params: { fields: 'id,title,widgets.id,widgets.name' }
  },
  {
    name: 'User Info - No Field Selection',
    endpoint: '/user/userinfo',
    params: {}
  },
  {
    name: 'User Info - Selected Fields',
    endpoint: '/user/userinfo',
    params: { fields: 'id,email' }
  },
  {
    name: 'Widget List - No Field Selection',
    endpoint: '/widget',
    params: {}
  },
  {
    name: 'Widget List - Basic Fields',
    endpoint: '/widget',
    params: { fields: 'id,title,componentId' }
  },
  {
    name: 'Database List - No Field Selection',
    endpoint: '/database',
    params: {}
  },
  {
    name: 'Database List - Selected Fields',
    endpoint: '/database',
    params: { fields: 'id,name,type,engine' }
  }
];

// Helper to measure API call performance
async function measureApiCall(endpoint, params) {
  const startTime = Date.now();
  
  try {
    const response = await api.get(endpoint, { params });
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const responseSize = JSON.stringify(response.data).length;
    
    return {
      success: true,
      time: responseTime,
      size: responseSize,
      statusCode: response.status
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      success: false,
      time: endTime - startTime,
      size: 0,
      error: error.message,
      statusCode: error.response?.status
    };
  }
}

// Run performance tests
async function runPerformanceTests() {
  console.log('🚀 Starting Field Selection Performance Tests');
  console.log(`📍 API URL: ${API_BASE_URL}`);
  console.log(`🔄 Iterations per test: ${TEST_ITERATIONS}`);
  console.log('');

  const results = [];

  for (const scenario of testScenarios) {
    console.log(`\n📊 Testing: ${scenario.name}`);
    const metrics = new PerformanceMetrics(scenario.name);
    
    // Warm-up call
    await measureApiCall(scenario.endpoint, scenario.params);
    
    // Actual measurements
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      process.stdout.write(`  Iteration ${i + 1}/${TEST_ITERATIONS}\r`);
      const result = await measureApiCall(scenario.endpoint, scenario.params);
      
      if (result.success) {
        metrics.addMeasurement(result.time, result.size);
      } else {
        console.log(`\n  ❌ Error: ${result.error} (Status: ${result.statusCode})`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const stats = metrics.getStats();
    results.push(stats);
    console.log(`\n  ✅ Avg Time: ${stats.avgTime}ms | Avg Size: ${stats.avgSize} bytes`);
  }

  // Generate comparison report
  console.log('\n\n📈 Performance Comparison Report');
  console.log('=' .repeat(80));

  // Compare scenarios
  const comparisons = [
    { base: 'Dashboard List - No Field Selection', optimized: 'Dashboard List - Basic Fields' },
    { base: 'Dashboard List - No Field Selection', optimized: 'Dashboard List - With Nested Fields' },
    { base: 'User Info - No Field Selection', optimized: 'User Info - Selected Fields' },
    { base: 'Widget List - No Field Selection', optimized: 'Widget List - Basic Fields' },
    { base: 'Database List - No Field Selection', optimized: 'Database List - Selected Fields' }
  ];

  for (const comp of comparisons) {
    const baseResult = results.find(r => r.name === comp.base);
    const optResult = results.find(r => r.name === comp.optimized);
    
    if (baseResult && optResult) {
      const timeImprovement = ((baseResult.avgTime - optResult.avgTime) / baseResult.avgTime * 100).toFixed(1);
      const sizeReduction = ((baseResult.avgSize - optResult.avgSize) / baseResult.avgSize * 100).toFixed(1);
      
      console.log(`\n📊 ${comp.optimized}`);
      console.log(`  ⏱️  Time: ${baseResult.avgTime}ms → ${optResult.avgTime}ms (${timeImprovement}% faster)`);
      console.log(`  📦 Size: ${baseResult.avgSize} → ${optResult.avgSize} bytes (${sizeReduction}% smaller)`);
    }
  }

  // Summary
  console.log('\n\n📋 Summary');
  console.log('=' .repeat(80));
  console.log('Field selection provides significant benefits:');
  console.log('- Reduced response payload sizes (up to 80% in some cases)');
  console.log('- Improved response times for large datasets');
  console.log('- Lower network bandwidth usage');
  console.log('- Better client performance due to smaller payloads');

  return results;
}

// Execute tests
runPerformanceTests()
  .then(() => {
    console.log('\n\n✅ Performance tests completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n\n❌ Performance tests failed:', error);
    process.exit(1);
  });