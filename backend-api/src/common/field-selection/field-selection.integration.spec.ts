import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication, UseInterceptors } from '@nestjs/common';
import request from 'supertest';
import { FieldSelection, PredefinedFields } from './field-selection.decorator';
import { FieldSelectionInterceptor } from './field-selection.interceptor';
import { FieldSelectionService } from './field-selection.service';

// Test the field-selection HTTP contract without booting unrelated AI, database or auth modules.
// These fixtures are not evidence that production routes authorize access correctly.
@Controller('selection-fixture')
@UseInterceptors(FieldSelectionInterceptor)
class FieldSelectionFixtureController {
  @Get('dashboard')
  @FieldSelection({ allowedFields: ['id', 'title', 'description'] })
  dashboard() {
    return { id: 1, title: 'Dashboard', description: 'Summary' };
  }

  @Get('user')
  @FieldSelection({ allowedFields: ['id', 'email'], excludeFields: ['password', 'jwtId'] })
  user() {
    return { id: 2, email: 'example@example.test', password: 'private', jwtId: 99 };
  }

  @Get('widget')
  @PredefinedFields('widgetWithConfig')
  widget() {
    return { id: 3, title: 'Widget', componentId: 1, datasetId: 4, internal: 'hidden' };
  }

  @Get('dataset')
  @PredefinedFields('datasetMeta')
  dataset() {
    return { id: 4, title: 'Dataset', databaseId: 5, query: 'private SQL' };
  }

  @Get('database')
  @FieldSelection({ allowedFields: ['id', 'name'], excludeFields: ['connectionConfig'] })
  database() {
    return { id: 5, name: 'Source', connectionConfig: 'private configuration' };
  }
}

describe('Field selection isolated HTTP integration', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FieldSelectionFixtureController],
      providers: [FieldSelectionService, FieldSelectionInterceptor],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
  });

  it('returns requested allowed dashboard fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/selection-fixture/dashboard?fields=id,title')
      .expect(200);
    expect(response.body).toEqual({ id: 1, title: 'Dashboard' });
  });
  it('preserves the preprojected response when no fields are requested', async () => {
    const response = await request(app.getHttpServer())
      .get('/selection-fixture/dashboard')
      .expect(200);
    expect(response.body).toEqual({ id: 1, title: 'Dashboard', description: 'Summary' });
  });
  it('omits explicitly requested password and JWT fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/selection-fixture/user?fields=id,email,password,jwtId')
      .expect(200);
    expect(response.body).toEqual({ id: 2, email: 'example@example.test' });
  });
  it('honors predefined widget fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/selection-fixture/widget?fields=id,datasetId,internal')
      .expect(200);
    expect(response.body).toEqual({ id: 3, datasetId: 4 });
  });
  it('honors predefined dataset metadata fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/selection-fixture/dataset?fields=id,databaseId,query')
      .expect(200);
    expect(response.body).toEqual({ id: 4, databaseId: 5 });
  });
  it('omits explicitly requested source connection configuration', async () => {
    const response = await request(app.getHttpServer())
      .get('/selection-fixture/database?fields=id,name,connectionConfig')
      .expect(200);
    expect(response.body).toEqual({ id: 5, name: 'Source' });
  });
});
