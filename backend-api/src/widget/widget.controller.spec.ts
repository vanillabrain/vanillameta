import { SourceAccessService } from '../ownership/source-access.service';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

describe('WidgetController', () => {
  let controller: WidgetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetController],
      providers: [
        { provide: SourceAccessService, useValue: {} },
        { provide: WidgetService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WidgetController>(WidgetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('passes the verified actor and JWT epoch to DELETE without dropping guards', async () => {
    const remove = jest.fn().mockResolvedValue('deleted');
    const actor = jest.fn(value => value);
    const target = new WidgetController({ remove } as any, { actor } as any);
    expect(await target.remove('21', { user: { accessKeyData: { id: 7, authVersion: 3 } } })).toBe(
      'deleted',
    );
    expect(actor).toHaveBeenCalledWith(7);
    expect(remove).toHaveBeenCalledWith(21, 7, 3);
    expect(Reflect.getMetadata('__guards__', WidgetController).map(guard => guard.name)).toEqual([
      'JwtAuthGuard',
      'SourceOwnershipGuard',
    ]);
  });
});
