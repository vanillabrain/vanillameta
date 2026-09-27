import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn } from '../setup/test-app';
import { createCustomerDb } from '../fixtures/customer-db';

describe('Query execute (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let databaseId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app);

    const customerDbPath = await createCustomerDb();
    const created = await request(app.getHttpServer())
      .post('/v1/database')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'e2e query sqlite',
        engine: 'sqlite3',
        type: 'sqlite',
        connectionConfig: { filename: customerDbPath },
      })
      .expect(201);

    databaseId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('SELECT 쿼리를 실행하면 데이터와 필드 정보를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/database/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: databaseId, query: 'select * from sample_table1 order by id' })
      .expect(201);

    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.datas).toHaveLength(3);
    expect(res.body.datas[0].name).toBe('alpha');

    const columns = res.body.fields.map((f: any) => f.columnName);
    expect(columns).toEqual(expect.arrayContaining(['id', 'name', 'amount', 'created_at']));
  });

  it('존재하지 않는 테이블 조회는 ERROR 상태를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/database/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: databaseId, query: 'select * from no_such_table' })
      .expect(201);

    expect(res.body.status).toBe('ERROR');
  });

  it.each(['DELETE FROM sample_table1', 'DROP TABLE sample_table1', 'UPDATE sample_table1 SET amount = 0'])(
    '읽기 전용 가드가 쓰기 쿼리를 400 으로 거부한다: %s',
    async query => {
      await request(app.getHttpServer())
        .post('/v1/database/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: databaseId, query })
        .expect(400);
    },
  );

  it('데이터소스 데이터 조회(TABLE)는 datas 와 fields 를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/database/data')
      .query({ datasetType: 'TABLE', databaseId, tableName: 'sample_table1' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.datas).toHaveLength(3);
    expect(Array.isArray(res.body.data.fields)).toBe(true);
  });
});
