import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

// Correlation ID를 위한 AsyncLocalStorage 컨텍스트
interface CorrelationContext {
  correlationId: string;
}

@Injectable({ scope: Scope.DEFAULT })
export class CorrelationIdService {
  private static asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

  /**
   * 현재 요청의 correlation ID를 설정합니다.
   * @param correlationId 요청의 고유 ID
   * @param callback 실행할 콜백 함수
   */
  static run<T>(correlationId: string, callback: () => T): T {
    return this.asyncLocalStorage.run({ correlationId }, callback);
  }

  /**
   * 현재 요청의 correlation ID를 반환합니다.
   * @returns correlation ID 또는 undefined
   */
  static getCorrelationId(): string | undefined {
    const context = this.asyncLocalStorage.getStore();
    return context?.correlationId;
  }

  /**
   * 현재 요청의 correlation ID를 반환합니다 (인스턴스 메서드).
   * @returns correlation ID 또는 undefined
   */
  getCorrelationId(): string | undefined {
    return CorrelationIdService.getCorrelationId();
  }
}