const Sequencer = require('@jest/test-sequencer').default;
const fs = require('fs');
const path = require('path');

class FastSequencer extends Sequencer {
  /**
   * 파일 크기와 이름을 기반으로 테스트 실행 순서 최적화
   * 작은 파일을 먼저 실행하여 빠른 피드백 제공
   */
  sort(tests) {
    const copyTests = Array.from(tests);
    
    return copyTests.sort((testA, testB) => {
      // 파일 크기 가져오기
      const getSizeSync = (filePath) => {
        try {
          const stats = fs.statSync(filePath);
          return stats.size;
        } catch {
          return 0;
        }
      };
      
      const sizeA = getSizeSync(testA.path);
      const sizeB = getSizeSync(testB.path);
      
      // 작은 파일을 먼저 실행
      if (sizeA !== sizeB) {
        return sizeA - sizeB;
      }
      
      // 크기가 같으면 파일명으로 정렬
      return path.basename(testA.path).localeCompare(path.basename(testB.path));
    });
  }
}

module.exports = FastSequencer;