import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { cleanupTestOrders } from '../support/order-fixtures';
import { closeTestApp, createTestApp } from '../support/test-app';

interface OrderResponseBody {
  id: number;
  userId: number;
  instrumentId: number;
  side: string;
  type: string;
  size: number;
  price: string;
  status: string;
  rejectionReason: string | null;
  datetime: string;
}

interface ErrorResponseBody {
  code?: string;
  message: string | string[];
}

interface RawOrderStatusRow {
  id: number;
  status: string;
  size: number;
  price: string;
}

describe('PATCH /v1/orders/:orderId/cancel (functional)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
    dataSource = app.get(DataSource);
    await cleanupTestOrders(dataSource);
  });

  afterEach(async () => {
    await cleanupTestOrders(dataSource);
  });

  afterAll(async () => {
    const [{ count }] = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS count FROM orders',
    );
    expect(Number(count)).toBe(11);

    const seedNewOrders = await dataSource.query<
      Array<{ id: number; status: string }>
    >('SELECT id, status FROM orders WHERE id IN (5, 7) ORDER BY id ASC');
    expect(seedNewOrders).toEqual([
      { id: 5, status: 'NEW' },
      { id: 7, status: 'NEW' },
    ]);

    await closeTestApp(app);
  });

  it('CA1 & CA2: cancels a NEW order created with POST /v1/orders (200 CANCELLED), and returns 409 ORDER_NOT_CANCELLABLE if cancelled again', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        size: 5,
        price: 900,
      })
      .expect(201);

    const created = createRes.body as OrderResponseBody;
    expect(created.status).toBe('NEW');

    const cancelRes = await request(app.getHttpServer())
      .patch(`/v1/orders/${created.id}/cancel`)
      .expect(200);

    const cancelled = cancelRes.body as OrderResponseBody;
    expect(cancelled).toEqual({
      id: created.id,
      userId: 1,
      instrumentId: 47,
      side: 'BUY',
      type: 'LIMIT',
      size: 5,
      price: '900.00',
      status: 'CANCELLED',
      rejectionReason: null,
      datetime: created.datetime,
    });

    const dbRows = await dataSource.query<RawOrderStatusRow[]>(
      'SELECT id, status, size, price FROM orders WHERE id = $1',
      [created.id],
    );
    expect(dbRows).toEqual([
      {
        id: created.id,
        status: 'CANCELLED',
        size: 5,
        price: '900.00',
      },
    ]);

    const secondCancelRes = await request(app.getHttpServer())
      .patch(`/v1/orders/${created.id}/cancel`)
      .expect(409);

    expect(secondCancelRes.body as ErrorResponseBody).toMatchObject({
      code: 'ORDER_NOT_CANCELLABLE',
    });
  });

  it('CA3: returns 409 ORDER_NOT_CANCELLABLE when attempting to cancel a newly created FILLED order and leaves it FILLED', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      })
      .expect(201);

    const created = createRes.body as OrderResponseBody;
    expect(created.status).toBe('FILLED');

    const cancelRes = await request(app.getHttpServer())
      .patch(`/v1/orders/${created.id}/cancel`)
      .expect(409);

    expect(cancelRes.body as ErrorResponseBody).toMatchObject({
      code: 'ORDER_NOT_CANCELLABLE',
    });

    const dbRows = await dataSource.query<Array<{ status: string }>>(
      'SELECT status FROM orders WHERE id = $1',
      [created.id],
    );
    expect(dbRows).toEqual([{ status: 'FILLED' }]);
  });

  it('CA4: returns 409 ORDER_NOT_CANCELLABLE when attempting to cancel a newly created REJECTED order and leaves it REJECTED', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({
        userId: 2,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      })
      .expect(201);

    const created = createRes.body as OrderResponseBody;
    expect(created.status).toBe('REJECTED');

    const cancelRes = await request(app.getHttpServer())
      .patch(`/v1/orders/${created.id}/cancel`)
      .expect(409);

    expect(cancelRes.body as ErrorResponseBody).toMatchObject({
      code: 'ORDER_NOT_CANCELLABLE',
    });

    const dbRows = await dataSource.query<Array<{ status: string }>>(
      'SELECT status FROM orders WHERE id = $1',
      [created.id],
    );
    expect(dbRows).toEqual([{ status: 'REJECTED' }]);
  });

  it('CA5: returns 409 ORDER_NOT_CANCELLABLE for seed orders 2 (FILLED), 3 (CANCELLED), and 6 (REJECTED) without changing them', async () => {
    for (const orderId of [2, 3, 6]) {
      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/cancel`)
        .expect(409);

      expect(res.body as ErrorResponseBody).toMatchObject({
        code: 'ORDER_NOT_CANCELLABLE',
      });
    }

    const dbRows = await dataSource.query<
      Array<{ id: number; status: string }>
    >('SELECT id, status FROM orders WHERE id IN (2, 3, 6) ORDER BY id ASC');
    expect(dbRows).toEqual([
      { id: 2, status: 'FILLED' },
      { id: 3, status: 'CANCELLED' },
      { id: 6, status: 'REJECTED' },
    ]);
  });

  it('CA6: returns 404 ORDER_NOT_FOUND when orderId does not exist (99999)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/orders/99999/cancel')
      .expect(404);

    expect(res.body as ErrorResponseBody).toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])(
    'CA7: returns 400 when orderId is invalid (%s)',
    async (invalidOrderId) => {
      await request(app.getHttpServer())
        .patch(`/v1/orders/${invalidOrderId}/cancel`)
        .expect(400);
    },
  );

  it('CA8: leaves the user portfolio identical before and after creating and cancelling a NEW order', async () => {
    const beforePortfolioRes = await request(app.getHttpServer())
      .get('/v1/users/1/portfolio')
      .expect(200);

    const createRes = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        size: 5,
        price: 900,
      })
      .expect(201);

    const created = createRes.body as OrderResponseBody;

    await request(app.getHttpServer())
      .patch(`/v1/orders/${created.id}/cancel`)
      .expect(200);

    const afterPortfolioRes = await request(app.getHttpServer())
      .get('/v1/users/1/portfolio')
      .expect(200);

    expect(afterPortfolioRes.body).toEqual(beforePortfolioRes.body);
  });

  it('CA9: handles two simultaneous cancellations of the same NEW order with Promise.all so one returns 200 and the other 409', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        size: 5,
        price: 900,
      })
      .expect(201);

    const created = createRes.body as OrderResponseBody;
    expect(created.status).toBe('NEW');

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer()).patch(`/v1/orders/${created.id}/cancel`),
      request(app.getHttpServer()).patch(`/v1/orders/${created.id}/cancel`),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const okResponse = res1.status === 200 ? res1 : res2;
    const conflictResponse = res1.status === 409 ? res1 : res2;

    expect((okResponse.body as OrderResponseBody).status).toBe('CANCELLED');
    expect((conflictResponse.body as ErrorResponseBody).code).toBe(
      'ORDER_NOT_CANCELLABLE',
    );
  });

  it('CA10: leaves the original 11 orders intact and orders 5 and 7 in NEW status', async () => {
    const [{ count }] = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS count FROM orders',
    );
    expect(Number(count)).toBe(11);

    const seedNewOrders = await dataSource.query<
      Array<{ id: number; status: string }>
    >('SELECT id, status FROM orders WHERE id IN (5, 7) ORDER BY id ASC');
    expect(seedNewOrders).toEqual([
      { id: 5, status: 'NEW' },
      { id: 7, status: 'NEW' },
    ]);
  });
});
