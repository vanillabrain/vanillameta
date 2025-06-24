export const repositoryMockFactory = () => ({
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
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    query: jest.fn(),
  },
});

export type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;