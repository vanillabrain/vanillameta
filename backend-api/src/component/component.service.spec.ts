import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComponentService } from './component.service';
import { Component } from './entities/component.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateComponentDto } from './dto/create-component.dto';

describe('ComponentService', () => {
  let service: ComponentService;
  let repository: ReturnType<typeof mockRepository>;
  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentService,
        { provide: getRepositoryToken(Component), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<ComponentService>(ComponentService);
    repository = module.get(getRepositoryToken(Component));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects duplicate creation without saving another component', async () => {
    repository.findOne.mockResolvedValue({ id: 7, type: 'QaType' });

    await expect(
      service.create(
        Object.assign(new CreateComponentDto(), {
          type: 'QaType',
          title: 'QA',
          category: 'SCORE',
          option: '{}',
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects a missing component read', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
  });

  it('rejects deletion when no component was affected', async () => {
    repository.delete.mockResolvedValue({ affected: 0 });

    await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.delete).toHaveBeenCalledWith({ id: 999 });
  });
});
