import { Module } from '@nestjs/common';
import { ComponentService } from './component.service';
import { ComponentController } from './component.controller';

@Module({
  controllers: [ComponentController],
  providers: [ComponentService]
})
export class ComponentModule {}
