// jest 실행 전 테스트 환경을 강제한다.
// (셸에 NODE_ENV=production 이 설정되어 있으면 React 프로덕션 빌드가 로드되어
//  @testing-library 의 act() 가 동작하지 않는다.)
process.env.NODE_ENV = 'test';
