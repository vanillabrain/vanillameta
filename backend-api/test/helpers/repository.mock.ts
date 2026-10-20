import { Repository, SelectQueryBuilder, DeepPartial } from 'typeorm';

/**
 * TypeORM Repository 모킹 헬퍼
 * 모든 repository 메서드에 대한 기본 mock 구현 제공
 */
export const createMockRepository = <T = any>(): jest.Mocked<Repository<T>> => {
  const mockQueryBuilder: jest.Mocked<SelectQueryBuilder<T>> = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    andHaving: jest.fn().mockReturnThis(),
    orHaving: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getOneOrFail: jest.fn().mockRejectedValue(new Error('Entity not found')),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    stream: jest.fn(),
    execute: jest.fn().mockResolvedValue({ raw: [], affected: 0 }),
    getQuery: jest.fn().mockReturnValue(''),
    getSql: jest.fn().mockReturnValue(''),
    clone: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    useTransaction: jest.fn().mockReturnThis(),
    setQueryRunner: jest.fn().mockReturnThis(),
  } as any;

  const mockRepository: jest.Mocked<Repository<T>> = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn().mockRejectedValue(new Error('Entity not found')),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findAndCountBy: jest.fn().mockResolvedValue([[], 0]),
    findBy: jest.fn().mockResolvedValue([]),
    findByIds: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
    remove: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
    delete: jest.fn().mockResolvedValue({ raw: [], affected: 0 }),
    softDelete: jest.fn().mockResolvedValue({ raw: [], affected: 0, generatedMaps: [] }),
    softRemove: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
    recover: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
    restore: jest.fn().mockResolvedValue({ raw: [], affected: 0, generatedMaps: [] }),
    insert: jest.fn().mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
    update: jest.fn().mockResolvedValue({ raw: [], affected: 0, generatedMaps: [] }),
    upsert: jest.fn().mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
    exist: jest.fn().mockResolvedValue(false),
    exists: jest.fn().mockResolvedValue(false),
    existsBy: jest.fn().mockResolvedValue(false),
    count: jest.fn().mockResolvedValue(0),
    countBy: jest.fn().mockResolvedValue(0),
    sum: jest.fn().mockResolvedValue(0),
    average: jest.fn().mockResolvedValue(0),
    minimum: jest.fn().mockResolvedValue(null),
    maximum: jest.fn().mockResolvedValue(null),
    increment: jest.fn().mockResolvedValue({ raw: [], affected: 0, generatedMaps: [] }),
    decrement: jest.fn().mockResolvedValue({ raw: [], affected: 0, generatedMaps: [] }),
    clear: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((entityLike?: DeepPartial<T>) => entityLike as T),
    merge: jest.fn().mockImplementation((mergeIntoEntity: T, ...entityLikes: DeepPartial<T>[]) => mergeIntoEntity),
    preload: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    query: jest.fn().mockResolvedValue([]),
    // Repository metadata
    metadata: {
      targetName: 'MockEntity',
      tableName: 'mock_entity',
      name: 'MockEntity',
      columns: [],
      relations: [],
      indices: [],
      uniques: [],
      checks: [],
      exclusions: [],
      embeddeds: [],
      inheritanceTree: [],
      discriminatorColumn: undefined,
      schema: undefined,
      synchronize: true,
      engine: undefined,
      database: undefined,
      givenTableName: 'mock_entity',
      target: jest.fn(),
      propertiesMap: {},
      ownColumns: [],
      ownRelations: [],
      relationIds: [],
      nonVirtualColumns: [],
      ownIndices: [],
      ownUniques: [],
      ownListeners: [],
      hasMultiplePrimaryKeys: false,
      hasUUIDGeneratedColumns: false,
      generatedColumns: [],
      primaryColumns: [],
      ancestorColumns: [],
      allEmbeddeds: [],
      ownEmbeddeds: [],
      isJunction: false,
      parentEntityMetadata: null,
      childEntityMetadatas: [],
      tableNameWithoutPrefix: 'mock_entity',
      tablePath: 'mock_entity',
      discriminatorValue: undefined,
      inheritancePattern: undefined,
      treeType: undefined,
      treeOptions: undefined,
      treeParentRelation: undefined,
      treeChildrenRelation: undefined,
      treeLevelColumn: undefined,
      nestedSetLeftColumn: undefined,
      nestedSetRightColumn: undefined,
      materializedPathColumn: undefined,
      objectIdColumn: undefined,
      createDateColumn: undefined,
      updateDateColumn: undefined,
      versionColumn: undefined,
      deleteDateColumn: undefined,
    } as any,
    manager: {} as any,
    target: jest.fn() as any,
  } as any;

  return mockRepository;
};

/**
 * Repository 메서드별 모킹 헬퍼
 */
export const mockRepositoryMethods = {
  mockFindOne: <T>(repository: jest.Mocked<Repository<T>>, returnValue: T | null) => {
    repository.findOne.mockResolvedValue(returnValue);
    repository.findOneBy.mockResolvedValue(returnValue);
  },
  
  mockFind: <T>(repository: jest.Mocked<Repository<T>>, returnValue: T[]) => {
    repository.find.mockResolvedValue(returnValue);
    repository.findBy.mockResolvedValue(returnValue);
  },
  
  mockSave: <T>(repository: jest.Mocked<Repository<T>>, implementation?: (entity: T) => T) => {
    if (implementation) {
      repository.save.mockImplementation((entity: any) => Promise.resolve(implementation(entity)));
    } else {
      repository.save.mockImplementation((entity: any) => Promise.resolve(entity));
    }
  },
  
  mockDelete: <T>(repository: jest.Mocked<Repository<T>>, affected: number = 1) => {
    repository.delete.mockResolvedValue({ raw: [], affected });
  },
  
  mockCount: <T>(repository: jest.Mocked<Repository<T>>, count: number) => {
    repository.count.mockResolvedValue(count);
    repository.countBy.mockResolvedValue(count);
  },
};

/**
 * QueryBuilder 체이닝 헬퍼
 */
export const setupQueryBuilderChain = <T>(
  queryBuilder: jest.Mocked<SelectQueryBuilder<T>>,
  finalResult: {
    getOne?: T | null;
    getMany?: T[];
    getCount?: number;
    getManyAndCount?: [T[], number];
  }
) => {
  if (finalResult.getOne !== undefined) {
    queryBuilder.getOne.mockResolvedValue(finalResult.getOne);
  }
  if (finalResult.getMany !== undefined) {
    queryBuilder.getMany.mockResolvedValue(finalResult.getMany);
  }
  if (finalResult.getCount !== undefined) {
    queryBuilder.getCount.mockResolvedValue(finalResult.getCount);
  }
  if (finalResult.getManyAndCount !== undefined) {
    queryBuilder.getManyAndCount.mockResolvedValue(finalResult.getManyAndCount);
  }
  
  return queryBuilder;
};