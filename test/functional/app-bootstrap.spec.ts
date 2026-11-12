import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { closeTestApp, createTestApp } from '../support/test-app';

describe('App bootstrap (functional)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await closeTestApp(app);
    }
  });

  it('boots the application and verifies the database connection responds', async () => {
    const dataSource = app.get(DataSource);
    expect(dataSource.isInitialized).toBe(true);

    const rows: Array<{ ok: number }> =
      await dataSource.query('SELECT 1 AS ok');
    expect(rows).toEqual([{ ok: 1 }]);
  });
});
