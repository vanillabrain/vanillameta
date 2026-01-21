#!/usr/bin/env node

/**
 * Lambda Layer 크기 분석 도구
 * 패키지별 크기를 분석하여 최적화 포인트를 찾습니다.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getSizeInBytes(dirPath) {
  try {
    if (process.platform === 'darwin') {
      // macOS
      const output = execSync(`du -sk "${dirPath}"`, { encoding: 'utf8' });
      return parseInt(output.split('\t')[0]) * 1024;
    } else {
      // Linux
      const output = execSync(`du -sb "${dirPath}"`, { encoding: 'utf8' });
      return parseInt(output.split('\t')[0]);
    }
  } catch (err) {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzePackages() {
  const nodeModulesPath = './node_modules';
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('node_modules 디렉토리가 존재하지 않습니다.');
    process.exit(1);
  }
  
  console.log('📊 Lambda Layer 패키지 크기 분석');
  console.log('=====================================\n');
  
  const packages = [];
  const packageDirs = fs.readdirSync(nodeModulesPath);
  
  // 스코프 패키지 처리
  for (const dir of packageDirs) {
    const dirPath = path.join(nodeModulesPath, dir);
    
    if (!fs.statSync(dirPath).isDirectory()) continue;
    
    if (dir.startsWith('@')) {
      // 스코프 패키지
      const scopedPackages = fs.readdirSync(dirPath);
      for (const scopedPkg of scopedPackages) {
        const scopedPath = path.join(dirPath, scopedPkg);
        if (fs.statSync(scopedPath).isDirectory()) {
          const size = getSizeInBytes(scopedPath);
          packages.push({
            name: `${dir}/${scopedPkg}`,
            size: size,
            path: scopedPath
          });
        }
      }
    } else {
      // 일반 패키지
      const size = getSizeInBytes(dirPath);
      packages.push({
        name: dir,
        size: size,
        path: dirPath
      });
    }
  }
  
  // 크기별 정렬
  packages.sort((a, b) => b.size - a.size);
  
  // 전체 크기 계산
  const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0);
  
  console.log(`전체 node_modules 크기: ${formatBytes(totalSize)}\n`);
  
  // 상위 20개 패키지 표시
  console.log('🔝 크기가 큰 상위 20개 패키지:');
  console.log('----------------------------------------');
  console.log('순위\t크기\t\t비율\t패키지명');
  console.log('----------------------------------------');
  
  const top20 = packages.slice(0, 20);
  top20.forEach((pkg, index) => {
    const percentage = ((pkg.size / totalSize) * 100).toFixed(1);
    console.log(`${(index + 1).toString().padStart(2)}\t${formatBytes(pkg.size).padEnd(12)}\t${percentage}%\t${pkg.name}`);
  });
  
  // 최적화 제안
  console.log('\n🎯 최적화 제안:');
  console.log('----------------------------------------');
  
  const largePkgs = packages.filter(pkg => pkg.size > 5 * 1024 * 1024); // 5MB 이상
  const testFiles = [];
  const docFiles = [];
  
  for (const pkg of largePkgs.slice(0, 10)) {
    const pkgPath = pkg.path;
    
    // 테스트 파일 확인
    ['test', 'tests', '__tests__', 'spec'].forEach(testDir => {
      const testPath = path.join(pkgPath, testDir);
      if (fs.existsSync(testPath)) {
        const testSize = getSizeInBytes(testPath);
        if (testSize > 100 * 1024) { // 100KB 이상
          testFiles.push({
            package: pkg.name,
            dir: testDir,
            size: testSize
          });
        }
      }
    });
    
    // 문서 파일 확인
    ['docs', 'documentation', 'examples', 'example'].forEach(docDir => {
      const docPath = path.join(pkgPath, docDir);
      if (fs.existsSync(docPath)) {
        const docSize = getSizeInBytes(docPath);
        if (docSize > 100 * 1024) { // 100KB 이상
          docFiles.push({
            package: pkg.name,
            dir: docDir,
            size: docSize
          });
        }
      }
    });
  }
  
  if (testFiles.length > 0) {
    console.log('\n📋 제거 가능한 테스트 파일:');
    testFiles.forEach(item => {
      console.log(`   • ${item.package}/${item.dir}: ${formatBytes(item.size)}`);
    });
  }
  
  if (docFiles.length > 0) {
    console.log('\n📚 제거 가능한 문서 파일:');
    docFiles.forEach(item => {
      console.log(`   • ${item.package}/${item.dir}: ${formatBytes(item.size)}`);
    });
  }
  
  // 대안 패키지 제안
  console.log('\n💡 대안 패키지 제안:');
  const alternatives = [
    { current: 'moment', alternative: 'dayjs', saving: '~67KB' },
    { current: 'lodash', alternative: 'lodash-es', saving: '~24KB' },
    { current: 'axios', alternative: 'node-fetch', saving: '~13KB' }
  ];
  
  alternatives.forEach(alt => {
    const currentPkg = packages.find(pkg => pkg.name === alt.current);
    if (currentPkg) {
      console.log(`   • ${alt.current} → ${alt.alternative} (절약: ${alt.saving})`);
    }
  });
  
  // 예상 절약 효과
  const potentialSavings = [...testFiles, ...docFiles].reduce((sum, item) => sum + item.size, 0);
  if (potentialSavings > 0) {
    console.log(`\n💾 예상 절약 효과: ${formatBytes(potentialSavings)} (${((potentialSavings / totalSize) * 100).toFixed(1)}%)`);
  }
  
  console.log('\n✨ 분석 완료!\n');
}

// 스크립트 실행
if (require.main === module) {
  try {
    analyzePackages();
  } catch (err) {
    console.error('분석 중 오류 발생:', err);
    process.exit(1);
  }
}

module.exports = { analyzePackages };