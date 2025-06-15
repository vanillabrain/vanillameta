#!/usr/bin/env node

/**
 * 폰트 사용량 분석 스크립트
 * 프로젝트 내 모든 소스 파일에서 사용되는 한글 문자를 추출하여
 * 최적화된 폰트 서브셋 생성을 위한 데이터를 수집합니다.
 */

const fs = require('fs');
const path = require('path');

// 분석할 파일 확장자
const targetExtensions = ['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.md', '.json'];

// 한글 문자 범위
const HANGUL_RANGES = {
  syllables: /[\uAC00-\uD7AF]/g,        // 한글 완성형 (가-힣)
  jamo: /[\u1100-\u11FF\u3130-\u318F]/g, // 한글 자모
  compatibility: /[\u3200-\u321E\u3260-\u327F]/g // 한글 호환 자모
};

// 기본 문자 범위
const BASIC_RANGES = {
  ascii: /[\u0020-\u007E]/g,            // 기본 ASCII
  latin1: /[\u00A0-\u00FF]/g,          // Latin-1 보완
  latinExtended: /[\u0100-\u017F]/g,   // Latin 확장-A
  punctuation: /[\u2000-\u206F]/g,     // 일반 구두점
  symbols: /[\u2100-\u214F]/g,         // 글자 형태 기호
  arrows: /[\u2190-\u21FF]/g,          // 화살표
  mathSymbols: /[\u2200-\u22FF]/g,     // 수학 기호
  miscSymbols: /[\u2600-\u26FF]/g,     // 기타 기호
  cjkSymbols: /[\u3000-\u303F]/g,      // CJK 기호 및 구두점
  halfFullForms: /[\uFF00-\uFFEF]/g,   // 반각/전각 형태
  specials: /[\uFE10-\uFE19\uFE30-\uFE4F]/g // 세로쓰기 형태
};

class FontUsageAnalyzer {
  constructor() {
    this.uniqueChars = new Set();
    this.fileCount = 0;
    this.characterFrequency = new Map();
    this.sourcesByExtension = new Map();
  }

  // 파일 시스템 재귀 스캔
  scanDirectory(dirPath, basePath = '') {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      // 제외할 디렉토리
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'build', 'dist', 'coverage'].includes(entry.name)) {
          this.scanDirectory(fullPath, relativePath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (targetExtensions.includes(ext)) {
          this.analyzeFile(fullPath, relativePath);
        }
      }
    }
  }

  // 개별 파일 분석
  analyzeFile(filePath, relativePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.fileCount++;
      
      const ext = path.extname(filePath);
      if (!this.sourcesByExtension.has(ext)) {
        this.sourcesByExtension.set(ext, []);
      }
      this.sourcesByExtension.get(ext).push(relativePath);
      
      // 모든 문자 추출 및 빈도 계산
      for (const char of content) {
        this.uniqueChars.add(char);
        this.characterFrequency.set(char, (this.characterFrequency.get(char) || 0) + 1);
      }
      
    } catch (error) {
      console.warn(`파일 읽기 실패: ${filePath} - ${error.message}`);
    }
  }

  // 문자를 범위별로 분류
  categorizeCharacters() {
    const categories = {
      hangul: new Set(),
      ascii: new Set(),
      latin: new Set(),
      punctuation: new Set(),
      symbols: new Set(),
      numbers: new Set(),
      other: new Set()
    };

    for (const char of this.uniqueChars) {
      const code = char.charCodeAt(0);
      
      if (HANGUL_RANGES.syllables.test(char) || 
          HANGUL_RANGES.jamo.test(char) || 
          HANGUL_RANGES.compatibility.test(char)) {
        categories.hangul.add(char);
      } else if (code >= 0x0020 && code <= 0x007E) {
        categories.ascii.add(char);
      } else if (code >= 0x00A0 && code <= 0x017F) {
        categories.latin.add(char);
      } else if (code >= 0x2000 && code <= 0x206F || 
                 code >= 0xFE10 && code <= 0xFE4F ||
                 code >= 0xFF00 && code <= 0xFFEF) {
        categories.punctuation.add(char);
      } else if (code >= 0x0030 && code <= 0x0039) {
        categories.numbers.add(char);
      } else if (code >= 0x2100 && code <= 0x26FF) {
        categories.symbols.add(char);
      } else {
        categories.other.add(char);
      }
    }

    return categories;
  }

  // 결과 보고서 생성
  generateReport() {
    const categories = this.categorizeCharacters();
    const report = {
      summary: {
        totalFiles: this.fileCount,
        totalUniqueCharacters: this.uniqueChars.size,
        analysisDate: new Date().toISOString()
      },
      characterCounts: {
        hangul: categories.hangul.size,
        ascii: categories.ascii.size,
        latin: categories.latin.size,
        punctuation: categories.punctuation.size,
        symbols: categories.symbols.size,
        numbers: categories.numbers.size,
        other: categories.other.size
      },
      unicodeRanges: this.generateUnicodeRanges(categories),
      topHangulCharacters: this.getTopCharacters(categories.hangul, 100),
      filesByExtension: Object.fromEntries(
        Array.from(this.sourcesByExtension.entries()).map(([ext, files]) => [
          ext, 
          { count: files.length, files: files.slice(0, 10) }
        ])
      )
    };

    return report;
  }

  // 빈도수 높은 문자 추출
  getTopCharacters(characterSet, limit = 50) {
    const charFreq = Array.from(characterSet)
      .map(char => ({
        char,
        frequency: this.characterFrequency.get(char) || 0,
        unicode: `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);

    return charFreq;
  }

  // Unicode 범위 생성
  generateUnicodeRanges(categories) {
    const ranges = {};
    
    for (const [category, chars] of Object.entries(categories)) {
      if (chars.size === 0) continue;
      
      const codes = Array.from(chars).map(char => char.charCodeAt(0)).sort((a, b) => a - b);
      const unicodeRanges = [];
      let start = codes[0];
      let end = codes[0];
      
      for (let i = 1; i < codes.length; i++) {
        if (codes[i] === end + 1) {
          end = codes[i];
        } else {
          unicodeRanges.push(start === end ? 
            `U+${start.toString(16).toUpperCase().padStart(4, '0')}` :
            `U+${start.toString(16).toUpperCase().padStart(4, '0')}-${end.toString(16).toUpperCase().padStart(4, '0')}`
          );
          start = end = codes[i];
        }
      }
      
      unicodeRanges.push(start === end ? 
        `U+${start.toString(16).toUpperCase().padStart(4, '0')}` :
        `U+${start.toString(16).toUpperCase().padStart(4, '0')}-${end.toString(16).toUpperCase().padStart(4, '0')}`
      );
      
      ranges[category] = unicodeRanges.join(', ');
    }
    
    return ranges;
  }

  // 최적화된 서브셋 추천
  recommendSubset() {
    const categories = this.categorizeCharacters();
    const topHangul = this.getTopCharacters(categories.hangul, 200);
    
    // 기본 필수 문자들
    const essentialChars = new Set([
      ...categories.ascii,
      ...categories.numbers,
      ...Array.from(categories.punctuation).slice(0, 50), // 자주 사용되는 구두점만
    ]);

    // 상위 빈도 한글 문자들
    const frequentHangul = new Set(topHangul.slice(0, 150).map(item => item.char));
    
    // 최적화된 서브셋
    const optimizedSubset = new Set([...essentialChars, ...frequentHangul]);
    
    return {
      totalCharacters: optimizedSubset.size,
      reductionPercentage: ((this.uniqueChars.size - optimizedSubset.size) / this.uniqueChars.size * 100).toFixed(1),
      characters: Array.from(optimizedSubset).sort(),
      unicodeList: Array.from(optimizedSubset)
        .map(char => `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
        .sort()
    };
  }
}

// 메인 실행
async function main() {
  console.log('🔍 VanillaMeta 프로젝트 폰트 사용량 분석 시작...\n');
  
  const analyzer = new FontUsageAnalyzer();
  const projectRoot = path.join(__dirname, '..');
  
  console.log(`📁 분석 경로: ${projectRoot}`);
  analyzer.scanDirectory(projectRoot);
  
  const report = analyzer.generateReport();
  const subset = analyzer.recommendSubset();
  
  // 보고서 출력
  console.log('\n📊 분석 결과:');
  console.log(`- 총 파일 수: ${report.summary.totalFiles}`);
  console.log(`- 고유 문자 수: ${report.summary.totalUniqueCharacters}`);
  console.log(`- 한글 문자 수: ${report.characterCounts.hangul}`);
  console.log(`- ASCII 문자 수: ${report.characterCounts.ascii}`);
  console.log(`- 기타 문자 수: ${report.characterCounts.other}`);
  
  console.log('\n🎯 최적화 추천:');
  console.log(`- 서브셋 문자 수: ${subset.totalCharacters}`);
  console.log(`- 문자 수 감소율: ${subset.reductionPercentage}%`);
  
  console.log('\n📝 상위 빈도 한글 문자 (Top 20):');
  report.topHangulCharacters.slice(0, 20).forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.char} (${item.unicode}) - ${item.frequency}회`);
  });

  // 파일로 상세 보고서 저장
  const outputPath = path.join(__dirname, 'font-usage-report.json');
  const fullReport = {
    ...report,
    optimizedSubset: subset
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(fullReport, null, 2), 'utf8');
  console.log(`\n📋 상세 보고서 저장됨: ${outputPath}`);

  // 서브셋 문자 리스트 저장
  const subsetPath = path.join(__dirname, 'font-subset-chars.txt');
  fs.writeFileSync(subsetPath, subset.characters.join(''), 'utf8');
  console.log(`📝 서브셋 문자 리스트 저장됨: ${subsetPath}`);

  console.log('\n✅ 분석 완료!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = FontUsageAnalyzer;