#!/usr/bin/env node

/**
 * API 압축 테스트 스크립트
 * 
 * 사용법: node scripts/test-compression.js [환경]
 * 예시: node scripts/test-compression.js dev
 */

const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

// 환경별 API URL
const API_URLS = {
  local: 'http://localhost:4000/v1',
  dev: 'https://dev-api.vanillameta.com/v1',
  prod: 'https://api.vanillameta.com/v1'
};

// 테스트할 엔드포인트
const TEST_ENDPOINTS = [
  { path: '/health', name: 'Health Check' },
  { path: '/component/all', name: 'Component List' },
  { path: '/dashboard/list', name: 'Dashboard List' },
  { path: '/widget/list', name: 'Widget List' },
];

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

async function testCompression(baseUrl, endpoint, token) {
  console.log(`\n${colors.blue}테스트: ${endpoint.name}${colors.reset}`);
  console.log(`URL: ${baseUrl}${endpoint.path}`);
  
  try {
    // 압축 없이 요청
    const responseNoGzip = await axios.get(`${baseUrl}${endpoint.path}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : undefined,
        'Accept-Encoding': 'identity', // 압축 비활성화
      },
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });
    
    // 압축 요청
    const responseGzip = await axios.get(`${baseUrl}${endpoint.path}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : undefined,
        'Accept-Encoding': 'gzip, deflate',
      },
      responseType: 'arraybuffer',
      decompress: false, // axios가 자동으로 압축 해제하지 않도록
      validateStatus: () => true,
    });
    
    const uncompressedSize = responseNoGzip.data.length;
    const compressedSize = responseGzip.data.length;
    const contentEncoding = responseGzip.headers['content-encoding'];
    
    // 압축이 적용되었는지 확인
    if (contentEncoding && contentEncoding.includes('gzip')) {
      // 압축 해제하여 원본 크기 확인
      const decompressed = await gunzip(responseGzip.data);
      const actualUncompressedSize = decompressed.length;
      
      const compressionRatio = ((actualUncompressedSize - compressedSize) / actualUncompressedSize * 100).toFixed(2);
      const saved = actualUncompressedSize - compressedSize;
      
      console.log(`${colors.green}✓ 압축 적용됨${colors.reset}`);
      console.log(`  - Content-Encoding: ${contentEncoding}`);
      console.log(`  - 원본 크기: ${formatBytes(actualUncompressedSize)}`);
      console.log(`  - 압축 크기: ${formatBytes(compressedSize)}`);
      console.log(`  - 압축률: ${colors.bright}${compressionRatio}%${colors.reset}`);
      console.log(`  - 절감: ${formatBytes(saved)}`);
      
      return {
        endpoint: endpoint.name,
        compressed: true,
        originalSize: actualUncompressedSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio),
        saved,
      };
    } else {
      console.log(`${colors.yellow}○ 압축 미적용${colors.reset}`);
      console.log(`  - 응답 크기: ${formatBytes(uncompressedSize)}`);
      console.log(`  - 이유: ${uncompressedSize < 1024 ? '1KB 미만' : '압축 설정 확인 필요'}`);
      
      return {
        endpoint: endpoint.name,
        compressed: false,
        originalSize: uncompressedSize,
        reason: uncompressedSize < 1024 ? 'Below threshold' : 'Not configured',
      };
    }
  } catch (error) {
    console.log(`${colors.red}✗ 오류 발생${colors.reset}`);
    console.log(`  - ${error.message}`);
    
    return {
      endpoint: endpoint.name,
      error: error.message,
    };
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getAuthToken(baseUrl) {
  try {
    // 테스트용 로그인 (실제 환경에 맞게 수정 필요)
    const response = await axios.post(`${baseUrl}/auth/signin`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    return response.data.accessToken;
  } catch (error) {
    console.log(`${colors.yellow}인증 토큰 획득 실패 - 공개 엔드포인트만 테스트${colors.reset}`);
    return null;
  }
}

async function main() {
  const env = process.argv[2] || 'local';
  const baseUrl = API_URLS[env];
  
  if (!baseUrl) {
    console.error(`${colors.red}알 수 없는 환경: ${env}${colors.reset}`);
    console.log('사용 가능한 환경: local, dev, prod');
    process.exit(1);
  }
  
  console.log(`${colors.bright}=== API 압축 테스트 ===${colors.reset}`);
  console.log(`환경: ${colors.yellow}${env}${colors.reset}`);
  console.log(`URL: ${baseUrl}`);
  
  // 인증 토큰 획득 시도
  const token = await getAuthToken(baseUrl);
  
  // 모든 엔드포인트 테스트
  const results = [];
  for (const endpoint of TEST_ENDPOINTS) {
    const result = await testCompression(baseUrl, endpoint, token);
    results.push(result);
  }
  
  // 요약 출력
  console.log(`\n${colors.bright}=== 테스트 요약 ===${colors.reset}`);
  
  const successfulTests = results.filter(r => !r.error);
  const compressedCount = successfulTests.filter(r => r.compressed).length;
  const totalSaved = successfulTests
    .filter(r => r.compressed)
    .reduce((sum, r) => sum + r.saved, 0);
  const avgCompressionRatio = successfulTests
    .filter(r => r.compressed)
    .reduce((sum, r, _, arr) => sum + r.compressionRatio / arr.length, 0);
  
  console.log(`총 테스트: ${results.length}`);
  console.log(`성공: ${colors.green}${successfulTests.length}${colors.reset}`);
  console.log(`압축 적용: ${colors.green}${compressedCount}${colors.reset}`);
  console.log(`평균 압축률: ${colors.bright}${avgCompressionRatio.toFixed(2)}%${colors.reset}`);
  console.log(`총 절감: ${colors.bright}${formatBytes(totalSaved)}${colors.reset}`);
  
  // 상세 결과 테이블
  console.log(`\n${colors.bright}상세 결과:${colors.reset}`);
  console.table(results.map(r => ({
    엔드포인트: r.endpoint,
    압축여부: r.compressed ? '✓' : '✗',
    원본크기: r.originalSize ? formatBytes(r.originalSize) : '-',
    압축크기: r.compressedSize ? formatBytes(r.compressedSize) : '-',
    압축률: r.compressionRatio ? `${r.compressionRatio}%` : '-',
    절감: r.saved ? formatBytes(r.saved) : '-',
    비고: r.error || r.reason || '-',
  })));
}

// 스크립트 실행
main().catch(error => {
  console.error(`${colors.red}스크립트 실행 중 오류 발생:${colors.reset}`, error);
  process.exit(1);
});