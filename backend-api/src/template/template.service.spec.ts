import { Test, TestingModule } from '@nestjs/testing';
import { TemplateService } from './template.service';
import { Template } from './entities/template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { createMockRepository, getRepositoryTokenFor } from '../../test/test-helpers';
import { YesNo } from '../common/enum/yn.enum';
import { ResponseStatus } from '../common/enum/response-status.enum';

describe('TemplateService', () => {
  let service: TemplateService;
  let templateRepository: any;
  let templateItemRepository: any;
  let widgetRepository: any;
  let componentRepository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        {
          provide: getRepositoryTokenFor(Template),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(TemplateItem),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Widget),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Component),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
    templateRepository = module.get(getRepositoryTokenFor(Template));
    templateItemRepository = module.get(getRepositoryTokenFor(TemplateItem));
    widgetRepository = module.get(getRepositoryTokenFor(Widget));
    componentRepository = module.get(getRepositoryTokenFor(Component));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active templates', async () => {
      const mockTemplates = [
        { id: 1, title: 'Template 1', useYn: YesNo.YES },
        { id: 2, title: 'Template 2', useYn: YesNo.YES },
      ];
      templateRepository.find.mockResolvedValue(mockTemplates);

      const result = await service.findAll();

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toEqual(mockTemplates);
      expect(templateRepository.find).toHaveBeenCalledWith({
        select: { id: true, title: true, description: true },
        where: { useYn: YesNo.YES },
      });
    });
  });

  describe('findOne', () => {
    it('should return template with items', async () => {
      const mockTemplate = { id: 1, title: 'Template 1' };
      const mockItems = [
        { id: 1, templateId: 1, widgetId: 1 },
        { id: 2, templateId: 1, widgetId: 2 },
      ];

      templateRepository.findOne.mockResolvedValue(mockTemplate);
      templateItemRepository.find.mockResolvedValue(mockItems);

      const result = await service.findOne(1);

      expect(templateRepository.findOne).toHaveBeenCalledWith({
        select: { id: true, title: true, description: true },
        where: { id: 1, useYn: YesNo.YES },
      });
      expect(templateItemRepository.find).toHaveBeenCalledWith({ where: { templateId: 1 } });
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should return error when template not found', async () => {
      templateRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect((result as any).message).toContain('템플릿이 존재하지 않습니다');
    });
  });

  describe('create', () => {
    it('should create a new template', async () => {
      const createDto = {
        title: 'New Template',
        description: 'Test description',
        layout: [],
      };
      const savedTemplate = { id: 1, ...createDto };

      templateRepository.save.mockResolvedValue(savedTemplate);

      const result = await service.create(createDto);

      expect(templateRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toEqual(savedTemplate);
    });
  });

  describe('remove', () => {
    it('should remove template and its items', async () => {
      templateRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(templateRepository.update).toHaveBeenCalledWith({ id: 1 }, { useYn: YesNo.NO });
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });
  });
});
