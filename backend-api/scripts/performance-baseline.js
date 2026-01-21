#!/usr/bin/env node

/**
 * VanillaMeta 성능 기준선 설정 및 모니터링 스크립트
 * 
 * 이 스크립트는:
 * 1. 시스템의 현재 성능을 측정하여 기준선을 설정
 * 2. 부하 테스트 결과를 기준선과 비교
 * 3. 성능 회귀 감지 및 알림
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class PerformanceBaseline {
  constructor() {
    this.baselineFile = path.join(__dirname, '../test-results/performance-baseline.json');
    this.resultsDir = path.join(__dirname, '../test-results/load-tests');
    this.thresholds = {
      response_time_p95: 2000,      // 95% 요청이 2초 이내
      response_time_avg: 500,       // 평균 응답시간 500ms 이내  
      error_rate: 0.05,             // 에러율 5% 이내
      throughput_min: 50,           // 최소 50 req/s 처리
      memory_usage_max: 512,        // 최대 메모리 사용량 512MB
      cpu_usage_max: 80,            // 최대 CPU 사용률 80%
    };
    
    this.apiEndpoints = [
      '/api/dashboard',
      '/api/widget', 
      '/api/component',
      '/api/dataset',
      '/api/template',
      '/api/user/profile'
    ];
  }

  /**
   * 성능 기준선 생성
   */
  async createBaseline(apiUrl = 'http://localhost:3000') {
    console.log('🎯 성능 기준선 생성 시작...');
    
    const baseline = {
      created_at: new Date().toISOString(),
      api_url: apiUrl,
      measurements: {},
      system_info: await this.getSystemInfo(),
      thresholds: this.thresholds
    };
    
    // 각 API 엔드포인트별 기준선 측정
    for (const endpoint of this.apiEndpoints) {
      console.log(`📊 측정 중: ${endpoint}`);
      
      try {
        const measurement = await this.measureEndpoint(apiUrl + endpoint);
        baseline.measurements[endpoint] = measurement;
        
        console.log(`  ✅ 평균: ${measurement.avg_response_time.toFixed(2)}ms`);
        console.log(`  ✅ P95: ${measurement.p95_response_time.toFixed(2)}ms`);
        
      } catch (error) {
        console.error(`  ❌ 측정 실패: ${error.message}`);
        baseline.measurements[endpoint] = { error: error.message };
      }
      
      // API 서버 부하 방지
      await this.sleep(1000);
    }
    
    // 시스템 리소스 측정
    baseline.system_baseline = await this.measureSystemResources();
    
    // 기준선 저장
    this.saveBaseline(baseline);
    
    console.log('✅ 성능 기준선 생성 완료');
    console.log(`📁 저장 위치: ${this.baselineFile}`);
    
    return baseline;
  }

  /**
   * 단일 엔드포인트 성능 측정
   */
  async measureEndpoint(url, samples = 10) {
    const measurements = [];
    
    for (let i = 0; i < samples; i++) {
      const start = Date.now();
      
      try {
        await this.makeRequest(url);
        const duration = Date.now() - start;
        measurements.push(duration);
        
      } catch (error) {
        // 에러도 응답 시간으로 기록 (타임아웃 등)
        const duration = Date.now() - start;
        measurements.push(duration);
      }
      
      // 요청 간격
      await this.sleep(100);
    }
    
    measurements.sort((a, b) => a - b);
    
    return {
      samples: measurements.length,
      min: measurements[0],
      max: measurements[measurements.length - 1],
      avg_response_time: measurements.reduce((a, b) => a + b) / measurements.length,
      p50_response_time: measurements[Math.floor(measurements.length * 0.5)],
      p95_response_time: measurements[Math.floor(measurements.length * 0.95)],
      p99_response_time: measurements[Math.floor(measurements.length * 0.99)],
      raw_measurements: measurements
    };
  }

  /**
   * HTTP 요청 실행
   */
  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const timeout = 5000;
      
      const req = client.get(url, { timeout }, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.setTimeout(timeout);
    });
  }

  /**
   * 시스템 정보 수집
   */
  async getSystemInfo() {
    const os = require('os');
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      total_memory: os.totalmem(),
      free_memory: os.freemem(),
      node_version: process.version,
      load_average: os.loadavg()
    };
  }

  /**
   * 시스템 리소스 측정
   */
  async measureSystemResources() {
    const os = require('os');
    
    // CPU 사용률 측정 (1초 간격으로 측정)
    const cpuUsage = await this.getCpuUsage();
    
    return {
      cpu_usage_percent: cpuUsage,
      memory_usage_mb: (os.totalmem() - os.freemem()) / 1024 / 1024,
      memory_usage_percent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
      load_average_1m: os.loadavg()[0],
      load_average_5m: os.loadavg()[1],
      load_average_15m: os.loadavg()[2]
    };
  }

  /**
   * CPU 사용률 계산
   */
  async getCpuUsage() {
    const os = require('os');
    
    const startCPUs = os.cpus();
    await this.sleep(1000);
    const endCPUs = os.cpus();
    
    let totalIdle = 0;
    let totalTick = 0;
    
    for (let i = 0; i < startCPUs.length; i++) {
      const startCPU = startCPUs[i];
      const endCPU = endCPUs[i];
      
      const startTotal = Object.values(startCPU.times).reduce((a, b) => a + b);
      const endTotal = Object.values(endCPU.times).reduce((a, b) => a + b);
      
      const idle = endCPU.times.idle - startCPU.times.idle;
      const total = endTotal - startTotal;
      
      totalIdle += idle;
      totalTick += total;
    }
    
    return 100 - (totalIdle / totalTick * 100);
  }

  /**
   * 부하 테스트 결과 분석
   */
  async analyzeLoadTestResults(resultsFile) {
    console.log('📊 부하 테스트 결과 분석 시작...');
    
    if (!fs.existsSync(resultsFile)) {
      throw new Error(`결과 파일을 찾을 수 없습니다: ${resultsFile}`);
    }
    
    const baseline = this.loadBaseline();
    if (!baseline) {
      console.warn('⚠️  기준선이 없습니다. 먼저 기준선을 생성해주세요.');
      return null;
    }
    
    const results = this.parseTestResults(resultsFile);
    const analysis = this.compareWithBaseline(results, baseline);
    
    // 분석 결과 출력
    this.printAnalysis(analysis);
    
    // 분석 결과 저장
    const analysisFile = resultsFile.replace('.json', '-analysis.json');
    fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
    
    console.log(`📁 분석 결과 저장: ${analysisFile}`);
    
    return analysis;
  }

  /**
   * 테스트 결과 파싱
   */
  parseTestResults(resultsFile) {
    const content = fs.readFileSync(resultsFile, 'utf8');
    const lines = content.trim().split('\n');
    
    // K6 JSON 출력 파싱
    const metrics = {};
    
    lines.forEach(line => {
      try {
        const data = JSON.parse(line);
        
        if (data.type === 'Point' && data.metric) {
          const metricName = data.metric;
          
          if (!metrics[metricName]) {
            metrics[metricName] = {
              values: [],
              tags: data.data.tags || {}
            };
          }
          
          metrics[metricName].values.push(data.data.value);
        }
      } catch (e) {
        // JSON 파싱 실패는 무시
      }
    });
    
    // 메트릭 통계 계산
    const summary = {};
    
    Object.keys(metrics).forEach(metricName => {
      const values = metrics[metricName].values;
      values.sort((a, b) => a - b);
      
      summary[metricName] = {
        count: values.length,
        min: values[0],
        max: values[values.length - 1],
        avg: values.reduce((a, b) => a + b) / values.length,
        p50: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
        p99: values[Math.floor(values.length * 0.99)]
      };
    });
    
    return summary;
  }

  /**
   * 기준선과 비교
   */
  compareWithBaseline(results, baseline) {
    const comparison = {
      timestamp: new Date().toISOString(),
      baseline_date: baseline.created_at,
      overall_status: 'PASS',
      regression_detected: false,
      issues: [],
      improvements: [],
      metrics_comparison: {}
    };
    
    // HTTP 요청 지속시간 비교
    const httpDuration = results['http_req_duration'];
    if (httpDuration) {
      const baselineAvg = this.getBaselineAverage(baseline);
      
      comparison.metrics_comparison.response_time = {
        current_avg: httpDuration.avg,
        current_p95: httpDuration.p95,
        baseline_avg: baselineAvg,
        avg_change_percent: ((httpDuration.avg - baselineAvg) / baselineAvg) * 100,
        threshold_met: httpDuration.p95 <= this.thresholds.response_time_p95
      };
      
      // 회귀 감지
      if (httpDuration.avg > baselineAvg * 1.2) {
        comparison.regression_detected = true;
        comparison.issues.push(`응답 시간이 기준선 대비 20% 증가: ${httpDuration.avg.toFixed(2)}ms vs ${baselineAvg.toFixed(2)}ms`);
      }
      
      // 임계값 체크
      if (httpDuration.p95 > this.thresholds.response_time_p95) {
        comparison.overall_status = 'FAIL';
        comparison.issues.push(`P95 응답시간이 임계값 초과: ${httpDuration.p95.toFixed(2)}ms > ${this.thresholds.response_time_p95}ms`);
      }
    }
    
    // 에러율 체크
    const httpFailed = results['http_req_failed'];
    if (httpFailed) {
      const errorRate = httpFailed.avg;
      
      comparison.metrics_comparison.error_rate = {
        current_rate: errorRate,
        threshold_met: errorRate <= this.thresholds.error_rate
      };
      
      if (errorRate > this.thresholds.error_rate) {
        comparison.overall_status = 'FAIL';
        comparison.issues.push(`에러율이 임계값 초과: ${(errorRate * 100).toFixed(2)}% > ${(this.thresholds.error_rate * 100)}%`);
      }
    }
    
    // 처리량 체크
    const httpReqs = results['http_reqs'];
    if (httpReqs) {
      const throughput = httpReqs.avg; // requests per second
      
      comparison.metrics_comparison.throughput = {
        current_rps: throughput,
        threshold_met: throughput >= this.thresholds.throughput_min
      };
      
      if (throughput < this.thresholds.throughput_min) {
        comparison.overall_status = 'FAIL';
        comparison.issues.push(`처리량이 임계값 미달: ${throughput.toFixed(2)} req/s < ${this.thresholds.throughput_min} req/s`);
      }
    }
    
    return comparison;
  }

  /**
   * 분석 결과 출력
   */
  printAnalysis(analysis) {
    console.log('\n📊 성능 분석 결과');
    console.log('='.repeat(50));
    
    console.log(`전체 상태: ${analysis.overall_status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`회귀 감지: ${analysis.regression_detected ? '⚠️  YES' : '✅ NO'}`);
    console.log(`분석 시간: ${analysis.timestamp}`);
    
    if (analysis.issues.length > 0) {
      console.log('\n❌ 발견된 이슈:');
      analysis.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    if (analysis.improvements.length > 0) {
      console.log('\n✅ 개선사항:');
      analysis.improvements.forEach(improvement => console.log(`  - ${improvement}`));
    }
    
    console.log('\n📈 메트릭 비교:');
    Object.keys(analysis.metrics_comparison).forEach(metric => {
      const data = analysis.metrics_comparison[metric];
      console.log(`  ${metric}:`);
      
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'number') {
          console.log(`    ${key}: ${data[key].toFixed(2)}`);
        } else {
          console.log(`    ${key}: ${data[key]}`);
        }
      });
    });
    
    console.log('='.repeat(50));
  }

  /**
   * 기준선 평균값 계산
   */
  getBaselineAverage(baseline) {
    const measurements = Object.values(baseline.measurements);
    const validMeasurements = measurements.filter(m => !m.error && m.avg_response_time);
    
    if (validMeasurements.length === 0) return 0;
    
    return validMeasurements.reduce((sum, m) => sum + m.avg_response_time, 0) / validMeasurements.length;
  }

  /**
   * 기준선 저장
   */
  saveBaseline(baseline) {
    const dir = path.dirname(this.baselineFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.baselineFile, JSON.stringify(baseline, null, 2));
  }

  /**
   * 기준선 로드
   */
  loadBaseline() {
    if (!fs.existsSync(this.baselineFile)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(this.baselineFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('기준선 파일 로드 실패:', error.message);
      return null;
    }
  }

  /**
   * 대기 함수
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * CI/CD 통합을 위한 종료 코드 반환
   */
  getExitCode(analysis) {
    if (!analysis) return 1;
    return analysis.overall_status === 'PASS' ? 0 : 1;
  }
}

// CLI 인터페이스
if (require.main === module) {
  const baseline = new PerformanceBaseline();
  
  const command = process.argv[2];
  const arg1 = process.argv[3];
  
  switch (command) {
    case 'create':
      baseline.createBaseline(arg1)
        .then(() => process.exit(0))
        .catch(error => {
          console.error('❌ 기준선 생성 실패:', error.message);
          process.exit(1);
        });
      break;
      
    case 'analyze':
      if (!arg1) {
        console.error('❌ 결과 파일 경로가 필요합니다.');
        console.log('사용법: node performance-baseline.js analyze <results-file>');
        process.exit(1);
      }
      
      baseline.analyzeLoadTestResults(arg1)
        .then(analysis => {
          const exitCode = baseline.getExitCode(analysis);
          process.exit(exitCode);
        })
        .catch(error => {
          console.error('❌ 분석 실패:', error.message);
          process.exit(1);
        });
      break;
      
    case 'show':
      const baselineData = baseline.loadBaseline();
      if (baselineData) {
        console.log(JSON.stringify(baselineData, null, 2));
      } else {
        console.error('❌ 기준선 파일이 없습니다.');
        process.exit(1);
      }
      break;
      
    default:
      console.log('VanillaMeta 성능 기준선 도구');
      console.log('');
      console.log('사용법:');
      console.log('  node performance-baseline.js create [api-url]   - 성능 기준선 생성');
      console.log('  node performance-baseline.js analyze <file>     - 테스트 결과 분석');
      console.log('  node performance-baseline.js show               - 현재 기준선 표시');
      console.log('');
      console.log('예시:');
      console.log('  node performance-baseline.js create http://localhost:3000');
      console.log('  node performance-baseline.js analyze ./test-results/load-tests/20240101/results.json');
      break;
  }
}

module.exports = PerformanceBaseline;