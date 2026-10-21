import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { FieldSelectionService } from './field-selection.service';
import { FieldSelectionInterceptor } from './field-selection.interceptor';

@Global()
@Module({
  providers: [
    FieldSelectionService,
    {
      provide: APP_INTERCEPTOR,
      useClass: FieldSelectionInterceptor,
    },
  ],
  exports: [FieldSelectionService],
})
export class FieldSelectionModule {}
