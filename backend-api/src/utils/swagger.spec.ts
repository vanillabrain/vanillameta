import { SwaggerModule } from '@nestjs/swagger';
import { setupSwagger } from './swagger';
import { filterDocumentsPathsByTags } from './swagger-APIhelper';
import * as fs from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
}));

jest.mock('./swagger-APIhelper', () => ({
  filterDocumentsPathsByTags: jest.fn(),
}));

describe('setupSwagger', () => {
  const dummyApp = {} as any;
  const fixturePaths = { '/v1/example': { get: { tags: ['dashboard'] } } };
  const OLD_ENV = process.env.SWAGGER_SPEC_PATH;

  const filteredDoc = () => ({
    openapi: '3.0.0',
    info: { title: 'fixture' },
    paths: fixturePaths,
  });

  beforeEach(() => {
    (fs.writeFileSync as jest.Mock).mockClear();
    (filterDocumentsPathsByTags as jest.Mock).mockReset().mockReturnValue(fixturePaths);
    jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({ openapi: '3.0.0', info: { title: 'fixture' }, paths: {} } as any);
    jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (OLD_ENV === undefined) {
      delete process.env.SWAGGER_SPEC_PATH;
    } else {
      process.env.SWAGGER_SPEC_PATH = OLD_ENV;
    }
  });

  const expectSetupCalled = () => {
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'api-docs',
      dummyApp,
      expect.objectContaining({ paths: fixturePaths }),
      expect.objectContaining({
        swaggerOptions: expect.objectContaining({
          defaultModelsExpandDepth: -1,
          persistAuthorization: true,
        }),
        customSiteTitle: 'VanillaMeta API Documentation',
      }),
    );
  };

  it('does not write a spec file when SWAGGER_SPEC_PATH is unset', () => {
    delete process.env.SWAGGER_SPEC_PATH;
    setupSwagger(dummyApp);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expectSetupCalled();
  });

  it('does not write a spec file when SWAGGER_SPEC_PATH is empty', () => {
    process.env.SWAGGER_SPEC_PATH = '';
    setupSwagger(dummyApp);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expectSetupCalled();
  });

  it('writes the filtered document to SWAGGER_SPEC_PATH when set', () => {
    process.env.SWAGGER_SPEC_PATH = '/tmp/vanillameta-swagger-fixture.json';
    setupSwagger(dummyApp);
    const [file, serialized] = (fs.writeFileSync as jest.Mock).mock.calls[0];
    expect(file).toBe('/tmp/vanillameta-swagger-fixture.json');
    expect(JSON.parse(serialized)).toEqual(
      expect.objectContaining({
        ...filteredDoc(),
        security: [{ AccessToken: [] }],
        components: expect.objectContaining({
          responses: expect.objectContaining({ UnauthorizedError: expect.any(Object) }),
        }),
      }),
    );
    expectSetupCalled();
  });
});
