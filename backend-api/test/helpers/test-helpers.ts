import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export class TestHelpers {
  static getMockRepository = (): Partial<Record<keyof Repository<any>, jest.Mock>> => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    manager: {
      transaction: jest.fn(),
    } as any,
  });

  static getRepositoryMock = (entity: any) => ({
    provide: getRepositoryToken(entity),
    useValue: TestHelpers.getMockRepository(),
  });
}

export const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(), 
  save: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  manager: {
    transaction: jest.fn(),
  },
});