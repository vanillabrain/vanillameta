#!/usr/bin/env node

/**
 * 번들 크기 분석 및 최적화 추천 스크립트
 * 빌드 후 번들 크기를 분석하고 최적화 가능한 부분을 제안합니다.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 번들 크기 분석을 시작합니다...\n');

// 1. 빌드 실행
console.log('📦 프로덕션 빌드를 실행합니다...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ 빌드가 완료되었습니다.\n');
} catch (error) {
  console.error('❌ 빌드 중 오류가 발생했습니다:', error);
  process.exit(1);
}

// 2. dist 폴더의 파일 크기 분석
const distPath = path.join(process.cwd(), 'dist');
const assetsPath = path.join(distPath, 'assets');

function getFileSizeInKB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(2);
}

function analyzeDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  const fileInfo = [];

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile()) {
      const sizeKB = getFileSizeInKB(filePath);
      fileInfo.push({
        name: file,
        size: parseFloat(sizeKB),
        type: path.extname(file)
      });
    }
  });

  return fileInfo.sort((a, b) => b.size - a.size);
}

// 3. 번들 분석 결과 출력
console.log('📊 번들 크기 분석 결과:\n');

if (fs.existsSync(assetsPath)) {
  const files = analyzeDirectory(assetsPath);
  
  // 파일 타입별 분류
  const jsFiles = files.filter(f => f.type === '.js');
  const cssFiles = files.filter(f => f.type === '.css');
  
  console.log('JavaScript 번들:');
  jsFiles.forEach(file => {
    const emoji = file.size > 500 ? '⚠️ ' : file.size > 250 ? '⚡' : '✅';
    console.log(`  ${emoji} ${file.name}: ${file.size} KB`);
  });
  
  console.log('\nCSS 번들:');
  cssFiles.forEach(file => {
    const emoji = file.size > 100 ? '⚠️ ' : '✅';
    console.log(`  ${emoji} ${file.name}: ${file.size} KB`);
  });
  
  // 총 크기 계산
  const totalJsSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
  const totalCssSize = cssFiles.reduce((sum, file) => sum + file.size, 0);
  const totalSize = totalJsSize + totalCssSize;
  
  console.log('\n📈 총 번들 크기:');
  console.log(`  JavaScript: ${totalJsSize.toFixed(2)} KB`);
  console.log(`  CSS: ${totalCssSize.toFixed(2)} KB`);
  console.log(`  전체: ${totalSize.toFixed(2)} KB`);
  
  // 4. 최적화 제안
  console.log('\n💡 최적화 제안:');
  
  // 큰 번들 확인
  const largeFiles = files.filter(f => f.size > 250);
  if (largeFiles.length > 0) {
    console.log('\n⚠️  크기가 큰 번들 (250KB 이상):');
    largeFiles.forEach(file => {
      console.log(`  - ${file.name} (${file.size} KB)`);
      
      // 파일명으로 원인 추정
      if (file.name.includes('echarts')) {
        console.log('    → ECharts 관련: 필요한 차트 타입만 import하도록 수정 고려');
      }
      if (file.name.includes('ace')) {
        console.log('    → Ace Editor 관련: 필요한 모드와 테마만 동적 로드 고려');
      }
      if (file.name.includes('mui')) {
        console.log('    → Material-UI 관련: 사용하지 않는 컴포넌트 제거 고려');
      }
    });
  }
  
  // 청크 수 확인
  const chunkCount = jsFiles.filter(f => f.name.includes('chunk')).length;
  if (chunkCount < 5) {
    console.log('\n📦 코드 스플리팅을 더 활용할 수 있습니다:');
    console.log('  - 라우트별 레이지 로딩 확대');
    console.log('  - 대용량 라이브러리 동적 import');
  }
  
  // CSS 최적화
  if (totalCssSize > 150) {
    console.log('\n🎨 CSS 최적화 가능:');
    console.log('  - Tailwind CSS의 purge 설정 확인');
    console.log('  - 사용하지 않는 CSS 제거');
  }
}

// 5. 번들 분석 리포트 생성
console.log('\n📄 상세 분석 리포트를 생성합니다...');
if (fs.existsSync(path.join(distPath, 'stats.html'))) {
  console.log('✅ stats.html 파일이 생성되었습니다. 브라우저에서 확인하세요.');
} else {
  console.log('ℹ️  rollup-plugin-visualizer를 설치하여 시각적 분석을 활용하세요:');
  console.log('   npm install --save-dev rollup-plugin-visualizer');
}

console.log('\n✨ 번들 분석이 완료되었습니다!');