import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdService } from './correlation-id.service';

describe('CorrelationIdService', () => {
  let service: CorrelationIdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdService],
    }).compile();

    service = module.get<CorrelationIdService>(CorrelationIdService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return undefined when no correlation ID is set', () => {
    expect(CorrelationIdService.getCorrelationId()).toBeUndefined();
    expect(service.getCorrelationId()).toBeUndefined();
  });

  it('should store and retrieve correlation ID within async context', (done) => {
    const testId = 'test-correlation-id-123';

    CorrelationIdService.run(testId, () => {
      // 정적 메서드로 접근
      expect(CorrelationIdService.getCorrelationId()).toBe(testId);
      
      // 인스턴스 메서드로 접근
      expect(service.getCorrelationId()).toBe(testId);
      
      done();
    });
  });

  it('should isolate correlation IDs between different async contexts', (done) => {
    const testId1 = 'test-id-1';
    const testId2 = 'test-id-2';
    let results: string[] = [];

    const callback1 = () => {
      setTimeout(() => {
        results.push(CorrelationIdService.getCorrelationId() || 'undefined');
        
        if (results.length === 2) {
          expect(results).toContain(testId1);
          expect(results).toContain(testId2);
          expect(results[0]).not.toBe(results[1]);
          done();
        }
      }, 10);
    };

    const callback2 = () => {
      setTimeout(() => {
        results.push(CorrelationIdService.getCorrelationId() || 'undefined');
        
        if (results.length === 2) {
          expect(results).toContain(testId1);
          expect(results).toContain(testId2);
          expect(results[0]).not.toBe(results[1]);
          done();
        }
      }, 5);
    };

    CorrelationIdService.run(testId1, callback1);
    CorrelationIdService.run(testId2, callback2);
  });

  it('should handle nested async contexts correctly', (done) => {
    const outerTestId = 'outer-test-id';
    const innerTestId = 'inner-test-id';

    CorrelationIdService.run(outerTestId, () => {
      expect(CorrelationIdService.getCorrelationId()).toBe(outerTestId);

      CorrelationIdService.run(innerTestId, () => {
        expect(CorrelationIdService.getCorrelationId()).toBe(innerTestId);
        
        setTimeout(() => {
          expect(CorrelationIdService.getCorrelationId()).toBe(innerTestId);
          done();
        }, 1);
      });
    });
  });
});