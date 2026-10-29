jest.mock('../dashboard-studio/studio.module', () => {
  const { Module } = jest.requireActual('@nestjs/common');
  class StudioModule {}
  Module({})(StudioModule);
  return { StudioModule };
});
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsModule } from './reports.module';
import { ReportsController } from './reports.controller';
import { StudioModule } from '../dashboard-studio/studio.module';
import { StudioService } from '../dashboard-studio/studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { REPORT_ENTITIES } from './report.entity';
@Module({ providers: [{ provide: StudioService, useValue: {} }], exports: [StudioService] })
class CaptureDependency {}
@Global()
@Module({
  providers: [{ provide: SourceAccessService, useValue: {} }],
  exports: [SourceAccessService],
})
class AccessDependency {}
it('resolves the report controller and its real JWT guard without starting a server', async () => {
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:', entities: REPORT_ENTITIES }),
      AccessDependency,
      ReportsModule,
    ],
  })
    .overrideModule(StudioModule)
    .useModule(CaptureDependency)
    .compile();
  try {
    expect(module.get(ReportsController)).toBeInstanceOf(ReportsController);
  } finally {
    await module.close();
  }
});
