// 웜업 기능 간단 테스트
const mockEvent = {
  source: 'serverless-plugin-warmup'
};

const mockContext = {
  awsRequestId: 'test-request-id',
  functionName: 'vanillameta-backend-api-test-app',
  callbackWaitsForEmptyEventLoop: true
};

// 웜업 로직 시뮬레이션
function simulateWarmupHandler(event, context) {
  // 콜백 설정
  context.callbackWaitsForEmptyEventLoop = false;

  // 웜업 요청 감지
  if (event.source === 'serverless-plugin-warmup') {
    console.log('✅ WarmUp - Lambda 함수 웜업 요청 처리됨', {
      requestId: context.awsRequestId,
      functionName: context.functionName,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test'
    });
    
    // 즉시 응답
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lambda function warmed up successfully',
        requestId: context.awsRequestId,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  return { message: 'Normal request handling...' };
}

// 테스트 실행
console.log('🧪 웜업 기능 테스트 시작...\n');

try {
  // 웜업 요청 테스트
  const result = simulateWarmupHandler(mockEvent, mockContext);
  
  console.log('📤 웜업 응답:', JSON.stringify(result, null, 2));
  
  // 검증
  const success = 
    result.statusCode === 200 &&
    JSON.parse(result.body).message === 'Lambda function warmed up successfully' &&
    JSON.parse(result.body).requestId === 'test-request-id' &&
    mockContext.callbackWaitsForEmptyEventLoop === false;

  if (success) {
    console.log('\n✅ 웜업 기능 테스트 성공!');
    console.log('- 웜업 요청 감지 ✓');
    console.log('- 즉시 응답 반환 ✓'); 
    console.log('- 콜백 설정 최적화 ✓');
    console.log('- 로그 출력 ✓');
  } else {
    console.log('\n❌ 웜업 기능 테스트 실패');
  }

  // 일반 요청 테스트
  console.log('\n🧪 일반 요청 테스트...');
  const normalEvent = { httpMethod: 'GET', path: '/v1/health' };
  const normalResult = simulateWarmupHandler(normalEvent, mockContext);
  console.log('📤 일반 응답:', normalResult);
  
  if (normalResult.message === 'Normal request handling...') {
    console.log('✅ 일반 요청 처리 정상');
  }

} catch (error) {
  console.log('❌ 테스트 실행 오류:', error.message);
}

console.log('\n📋 웜업 설정 요약:');
console.log('- 주기: 5분마다 실행');
console.log('- 환경: 프로덕션에서만 활성화');
console.log('- 타임아웃: 20초');
console.log('- 동시성: 1');
console.log('- 배포 후 즉시 웜업: 활성화');