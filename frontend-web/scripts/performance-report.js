#!/usr/bin/env node

/**
 * 성능 리포트 생성 스크립트
 * 
 * 사용법:
 * - yarn performance:report
 * - node scripts/performance-report.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// 리포트 디렉토리
const REPORT_DIR = path.join(__dirname, '../performance-reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// 리포트 디렉토리 생성
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// 성능 측정 대상 URL들
const TEST_URLS = [
  { name: 'Login Page', url: 'http://localhost:3000/login' },
  { name: 'Dashboard List', url: 'http://localhost:3000/dashboard' },
  { name: 'Widget Create', url: 'http://localhost:3000/widget/create' },
  { name: 'Data Management', url: 'http://localhost:3000/data' },
];

// Lighthouse 설정
const LIGHTHOUSE_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance'],
    formFactor: 'desktop',
    throttling: {
      rttMs: 40,
      throughputKbps: 10 * 1024,
      cpuSlowdownMultiplier: 1,
    },
    screenEmulation: {
      mobile: false,
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      disabled: false,
    },
  },
};

// 번들 분석
async function analyzeBundleSize() {
  console.log('📦 Analyzing bundle size...');
  
  try {
    // 번들 분석 실행
    await execPromise('yarn build:analyze', { cwd: path.join(__dirname, '..') });
    
    // webpack-bundle-analyzer가 생성한 stats.json 읽기
    const statsPath = path.join(__dirname, '../build/bundle-stats.json');
    if (fs.existsSync(statsPath)) {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      
      // 번들 크기 분석
      const bundles = stats.assets
        .filter(asset => asset.name.endsWith('.js') || asset.name.endsWith('.css'))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10); // 상위 10개
      
      return {
        totalSize: stats.assets.reduce((sum, asset) => sum + asset.size, 0),
        mainBundles: bundles.map(bundle => ({
          name: bundle.name,
          size: (bundle.size / 1024).toFixed(2) + ' KB',
          gzipSize: bundle.gzipSize ? (bundle.gzipSize / 1024).toFixed(2) + ' KB' : 'N/A',
        })),
      };
    }
  } catch (error) {
    console.error('Bundle analysis failed:', error);
    return null;
  }
}

// Lighthouse 성능 측정
async function runLighthouse(url, name) {
  console.log(`🔍 Running Lighthouse for ${name}...`);
  
  const configPath = path.join(REPORT_DIR, 'lighthouse-config.json');
  fs.writeFileSync(configPath, JSON.stringify(LIGHTHOUSE_CONFIG));
  
  const reportPath = path.join(REPORT_DIR, `lighthouse-${name.replace(/\s+/g, '-')}-${TIMESTAMP}.html`);
  
  try {
    const { stdout } = await execPromise(
      `npx lighthouse ${url} --config-path=${configPath} --output=html --output-path=${reportPath} --chrome-flags="--headless"`
    );
    
    // JSON 형식으로도 저장하여 분석
    const jsonReportPath = reportPath.replace('.html', '.json');
    await execPromise(
      `npx lighthouse ${url} --config-path=${configPath} --output=json --output-path=${jsonReportPath} --chrome-flags="--headless"`
    );
    
    // JSON 리포트 읽기
    const jsonReport = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));
    const metrics = jsonReport.audits.metrics.details.items[0];
    
    return {
      name,
      url,
      score: jsonReport.categories.performance.score * 100,
      metrics: {
        FCP: metrics.firstContentfulPaint,
        LCP: metrics.largestContentfulPaint,
        TTI: metrics.interactive,
        TBT: metrics.totalBlockingTime,
        CLS: metrics.cumulativeLayoutShift,
        SI: metrics.speedIndex,
      },
      reportPath,
    };
  } catch (error) {
    console.error(`Lighthouse failed for ${name}:`, error);
    return null;
  }
}

// 종합 리포트 생성
async function generateReport() {
  console.log('🚀 Starting performance report generation...\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
    },
    bundleAnalysis: null,
    lighthouseResults: [],
  };
  
  // 번들 분석
  report.bundleAnalysis = await analyzeBundleSize();
  
  // Lighthouse 측정 (개발 서버가 실행 중이어야 함)
  console.log('\n📊 Running Lighthouse performance tests...');
  console.log('⚠️  Make sure the development server is running on http://localhost:3000\n');
  
  for (const testUrl of TEST_URLS) {
    const result = await runLighthouse(testUrl.url, testUrl.name);
    if (result) {
      report.lighthouseResults.push(result);
    }
  }
  
  // 종합 리포트 생성
  const summaryPath = path.join(REPORT_DIR, `performance-summary-${TIMESTAMP}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  
  // 마크다운 리포트 생성
  const markdownReport = generateMarkdownReport(report);
  const markdownPath = path.join(REPORT_DIR, `performance-report-${TIMESTAMP}.md`);
  fs.writeFileSync(markdownPath, markdownReport);
  
  console.log('\n✅ Performance report generated successfully!');
  console.log(`📁 Reports saved to: ${REPORT_DIR}`);
  console.log(`📄 Summary: ${summaryPath}`);
  console.log(`📝 Markdown: ${markdownPath}`);
}

// 마크다운 리포트 생성
function generateMarkdownReport(report) {
  let markdown = `# Performance Report

Generated at: ${report.timestamp}

## Bundle Analysis

`;

  if (report.bundleAnalysis) {
    markdown += `Total bundle size: ${(report.bundleAnalysis.totalSize / 1024 / 1024).toFixed(2)} MB

### Top Bundles

| Bundle | Size | Gzip Size |
|--------|------|-----------|
`;
    
    report.bundleAnalysis.mainBundles.forEach(bundle => {
      markdown += `| ${bundle.name} | ${bundle.size} | ${bundle.gzipSize} |\n`;
    });
  }
  
  markdown += `\n## Lighthouse Performance Scores

| Page | Score | FCP | LCP | TTI | TBT | CLS | SI |
|------|-------|-----|-----|-----|-----|-----|-----|
`;
  
  report.lighthouseResults.forEach(result => {
    markdown += `| ${result.name} | ${result.score.toFixed(1)} | ${result.metrics.FCP}ms | ${result.metrics.LCP}ms | ${result.metrics.TTI}ms | ${result.metrics.TBT}ms | ${result.metrics.CLS} | ${result.metrics.SI}ms |\n`;
  });
  
  markdown += `
## Metrics Legend

- **FCP** (First Contentful Paint): 첫 번째 콘텐츠가 화면에 그려지는 시간
- **LCP** (Largest Contentful Paint): 가장 큰 콘텐츠가 화면에 그려지는 시간
- **TTI** (Time to Interactive): 페이지가 완전히 상호작용 가능한 시간
- **TBT** (Total Blocking Time): 메인 스레드가 차단된 총 시간
- **CLS** (Cumulative Layout Shift): 누적 레이아웃 이동
- **SI** (Speed Index): 페이지 콘텐츠가 시각적으로 표시되는 속도

## Recommendations

`;
  
  // 성능 개선 제안
  report.lighthouseResults.forEach(result => {
    if (result.score < 90) {
      markdown += `\n### ${result.name}\n`;
      
      if (result.metrics.LCP > 2500) {
        markdown += `- ⚠️ LCP가 ${result.metrics.LCP}ms로 느립니다. 이미지 최적화와 서버 응답 시간 개선이 필요합니다.\n`;
      }
      
      if (result.metrics.TBT > 200) {
        markdown += `- ⚠️ TBT가 ${result.metrics.TBT}ms로 높습니다. JavaScript 실행 최적화가 필요합니다.\n`;
      }
      
      if (result.metrics.CLS > 0.1) {
        markdown += `- ⚠️ CLS가 ${result.metrics.CLS}로 높습니다. 레이아웃 이동을 방지해야 합니다.\n`;
      }
    }
  });
  
  return markdown;
}

// 메인 실행
if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { generateReport };