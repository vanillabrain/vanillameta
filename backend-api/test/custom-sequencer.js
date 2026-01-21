const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  /**
   * 테스트 파일을 실행 순서대로 정렬
   * 1. 유닛 테스트 먼저 (controller, service)
   * 2. 통합 테스트
   * 3. E2E 테스트
   * 4. 성능 테스트
   */
  sort(tests) {
    const copyTests = Array.from(tests);
    
    return copyTests.sort((testA, testB) => {
      const pathA = testA.path;
      const pathB = testB.path;
      
      // 우선순위 점수 계산
      const getPriority = (path) => {
        if (path.includes('.controller.spec.ts')) return 1;
        if (path.includes('.service.spec.ts')) return 2;
        if (path.includes('.integration.spec.ts')) return 3;
        if (path.includes('e2e')) return 4;
        if (path.includes('performance')) return 5;
        if (path.includes('QTT-')) return 6; // 성능 테스트
        return 10;
      };
      
      const priorityA = getPriority(pathA);
      const priorityB = getPriority(pathB);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // 같은 우선순위면 파일명으로 정렬
      return pathA.localeCompare(pathB);
    });
  }
}

module.exports = CustomSequencer;