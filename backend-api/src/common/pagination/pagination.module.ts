import { Module, Global } from '@nestjs/common';
import { PaginationService } from './pagination.service';

/**
 * 페이지네이션 모듈
 *
 * 커서 기반 및 오프셋 기반 페이지네이션을 위한 공통 모듈입니다.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [PaginationModule],
 *   // ...
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({
  providers: [PaginationService],
  exports: [PaginationService],
})
export class PaginationModule {}
