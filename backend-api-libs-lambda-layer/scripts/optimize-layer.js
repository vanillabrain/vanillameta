#!/usr/bin/env node

/**
 * Lambda Layer 최적화 스크립트
 * 불필요한 파일을 제거하여 패키지 크기를 최소화합니다.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REMOVE_PATTERNS = [
  // 문서 파일
  '**/*.md',
  '**/*.txt',
  '**/README*',
  '**/CHANGELOG*',
  '**/AUTHORS*',
  '**/CONTRIBUTORS*',
  '**/HISTORY*',
  '**/LICENSE*',
  '**/LICENCE*',
  '**/NOTICE*',
  
  // 테스트 파일
  '**/test/**',
  '**/tests/**',
  '**/spec/**',
  '**/specs/**',
  '**/*.test.js',
  '**/*.spec.js',
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/coverage/**',
  '**/.nyc_output/**',
  
  // 빌드 및 설정 파일
  '**/.github/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/Makefile*',
  '**/makefile*',
  '**/gulpfile.js',
  '**/Gruntfile.js',
  '**/webpack.config.js',
  '**/rollup.config.js',
  '**/babel.config.js',
  '**/.eslintrc*',
  '**/.prettierrc*',
  '**/.babelrc*',
  '**/tsconfig.json',
  '**/tslint.json',
  '**/jest.config.js',
  
  // 소스맵 및 TypeScript 파일
  '**/*.map',
  '**/*.ts',
  '**/*.tsx',
  
  // 예제 및 데모
  '**/example/**',
  '**/examples/**',
  '**/demo/**',
  '**/demos/**',
  '**/sample/**',
  '**/samples/**',
  '**/docs/**',
  '**/documentation/**',
  
  // 개발 도구
  '**/node_modules/.bin/**',
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/CVS/**',
  
  // 임시 파일
  '**/.tmp/**',
  '**/tmp/**',
  '**/.temp/**',
  '**/temp/**',
  '**/*.log',
  '**/*.pid',
  '**/*.seed',
  '**/*.pid.lock',
  
  // 불필요한 설정 파일
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/.editorconfig',
  '**/.gitattributes',
  '**/.gitignore',
  '**/.npmignore',
  '**/.yarnrc',
  '**/.dockerignore',
  
  // 특정 패키지의 불필요한 파일들
  '**/locale/**',
  '**/locales/**',
  '**/i18n/**',
  '**/translations/**',
];

// TypeScript 선언 파일은 제외
const KEEP_PATTERNS = [
  '**/*.d.ts'
];

function deleteFiles(patterns, baseDir = './node_modules') {
  const glob = require('glob');
  
  patterns.forEach(pattern => {
    try {
      const files = glob.sync(pattern, { cwd: baseDir, absolute: true });
      files.forEach(file => {
        try {
          const stat = fs.statSync(file);
          if (stat.isDirectory()) {
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            fs.unlinkSync(file);
          }
        } catch (err) {
          // 파일이 이미 없거나 접근할 수 없는 경우 무시
        }
      });
    } catch (err) {
      console.warn(`Pattern ${pattern} 처리 중 오류:`, err.message);
    }
  });
}

function getSizeInMB(dirPath) {
  try {
    const output = execSync(`du -sm "${dirPath}"`, { encoding: 'utf8' });
    return parseInt(output.split('\t')[0]);
  } catch (err) {
    return 0;
  }
}

function optimizeLayer() {
  console.log('Lambda Layer 최적화 시작...');
  
  const nodeModulesPath = './node_modules';
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('node_modules 디렉토리가 존재하지 않습니다.');
    process.exit(1);
  }
  
  // 최적화 전 크기 측정
  const sizeBefore = getSizeInMB(nodeModulesPath);
  console.log(`최적화 전 크기: ${sizeBefore}MB`);
  
  // TypeScript 선언 파일을 제외한 패턴들 필터링
  const removePatterns = REMOVE_PATTERNS.filter(pattern => 
    !KEEP_PATTERNS.some(keepPattern => 
      pattern.includes(keepPattern.replace('**/', '').replace('*', ''))
    )
  );
  
  // 불필요한 파일 제거
  console.log('불필요한 파일 제거 중...');
  deleteFiles(removePatterns);
  
  // 특정 패키지별 추가 최적화
  console.log('패키지별 최적화 적용 중...');
  
  // aws-sdk 제거 (Lambda 런타임에서 제공)
  const awsSdkPath = path.join(nodeModulesPath, 'aws-sdk');
  if (fs.existsSync(awsSdkPath)) {
    fs.rmSync(awsSdkPath, { recursive: true, force: true });
    console.log('aws-sdk 제거됨 (Lambda 런타임에서 제공)');
  }
  
  // 바이너리 파일 정리 (필요한 것만 유지)
  const binPaths = [
    path.join(nodeModulesPath, '.bin'),
  ];
  
  binPaths.forEach(binPath => {
    if (fs.existsSync(binPath)) {
      fs.rmSync(binPath, { recursive: true, force: true });
    }
  });
  
  // 최적화 후 크기 측정
  const sizeAfter = getSizeInMB(nodeModulesPath);
  const reduction = sizeBefore - sizeAfter;
  const reductionPercent = ((reduction / sizeBefore) * 100).toFixed(1);
  
  console.log(`최적화 후 크기: ${sizeAfter}MB`);
  console.log(`크기 감소: ${reduction}MB (${reductionPercent}%)`);
  
  if (reductionPercent >= 30) {
    console.log('✅ 목표 달성: 30% 이상 크기 감소');
  } else {
    console.log(`⚠️  목표 미달성: 30% 목표, 실제 ${reductionPercent}%`);
  }
  
  console.log('Lambda Layer 최적화 완료!');
}

// 스크립트 실행
if (require.main === module) {
  try {
    optimizeLayer();
  } catch (err) {
    console.error('최적화 중 오류 발생:', err);
    process.exit(1);
  }
}

module.exports = { optimizeLayer };