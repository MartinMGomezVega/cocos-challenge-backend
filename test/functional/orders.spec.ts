import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { cleanupTestOrders, insertTestOrders } from '../support/order-fixtures';
import { closeTestApp, createTestApp } from '../support/test-app';

interface OrderResponseBody {
  id: number;
  userId: number;
  instrumentId: number;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  size: number;
  price: string;
  status: 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';
  rejectionReason:
    'AMOUNT_BELOW_PRICE' | 'INSUFFICIENT_FUNDS' | 'INSUFFICIENT_SHARES' | null;
  datetime: string;
}

interface PortfolioPositionDto {
  instrumentId: number;
  ticker: string;
  name: string;
  quantity: number;
  marketValue: string | null;
  totalReturnPct: string | null;
  dailyReturnPct: string | null;
}

interface PortfolioResponseBody {
  userId: number;
  totalAccountValue: string;
  availableCash: string;
  positions: PortfolioPositionDto[];
}

const USER_1_INITIAL_PORTFOLIO: PortfolioResponseBody = {
  userId: 1,
  totalAccountValue: '889756.00',
  availableCash: '753000.00',
  positions: [
    {
      instrumentId: 31,
      ticker: 'BMA',
      name: 'Banco Macro S.A.',
      quantity: -10,
      marketValue: '-15028.00',
      totalReturnPct: null,
      dailyReturnPct: '-1.15',
    },
    {
      instrumentId: 54,
      ticker: 'METR',
      name: 'MetroGAS S.A.',
      quantity: 500,
      marketValue: '114750.00',
      totalReturnPct: '-8.20',
      dailyReturnPct: '-1.08',
    },
    {
      instrumentId: 47,
      ticker: 'PAMP',
      name: 'Pampa Holding S.A.',
      quantity: 40,
      marketValue: '37034.00',
      totalReturnPct: '-0.45',
      dailyReturnPct: '0.44',
    },
  ],
};

describe('POST /v1/orders (CA1-CA29)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let unpricedInstrumentId: number;

  async function countOrders(): Promise<number> {
    const rows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*)::text AS count FROM orders`,
    );
    return Number(rows[0].count);
  }

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
    dataSource = app.get(DataSource);
    await cleanupTestOrders(dataSource);

    const rowsWithoutMarketData: Array<{ id: number }> = await dataSource.query(
      `SELECT i.id
       FROM instruments i
       LEFT JOIN marketdata m ON m.instrumentid = i.id
       WHERE i.type <> 'MONEDA' AND m.id IS NULL
       ORDER BY i.id ASC
       LIMIT 1`,
    );
    unpricedInstrumentId = rowsWithoutMarketData[0].id;
  });

  afterEach(async () => {
    await cleanupTestOrders(dataSource);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await cleanupTestOrders(dataSource);
      expect(await countOrders()).toBe(11);
    }
    if (app) {
      await closeTestApp(app);
    }
  });

  describe('Accepted orders (CA1-CA9) and persistence checks (CA27)', () => {
    it('CA1 & CA27: BUY MARKET 10 PAMP for user 1 returns 201 FILLED at "925.85", persists in UTC, and updates portfolio (cash "743741.50", PAMP 50)', async () => {
      const beforeMs = Date.now();

      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
        })
        .expect(201);

      const afterMs = Date.now();
      const body = res.body as OrderResponseBody;

      expect(body.id).toBeGreaterThan(11);
      expect(body.datetime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(body).toEqual({
        id: body.id,
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
        price: '925.85',
        status: 'FILLED',
        rejectionReason: null,
        datetime: body.datetime,
      });

      // CA27: Verify persisted row in orders table and UTC datetime
      const dbRows: Array<{
        id: number;
        userid: number;
        instrumentid: number;
        side: string;
        type: string;
        size: number;
        price: string;
        status: string;
        raw_datetime: string;
      }> = await dataSource.query(
        `SELECT id, userid, instrumentid, side, type, size, price, status,
                to_char(datetime, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS raw_datetime
         FROM orders
         WHERE id = $1`,
        [body.id],
      );

      expect(dbRows).toHaveLength(1);
      expect(dbRows[0]).toEqual({
        id: body.id,
        userid: 1,
        instrumentid: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
        price: '925.85',
        status: 'FILLED',
        raw_datetime: body.datetime,
      });

      const storedUtcMs = Date.parse(dbRows[0].raw_datetime);
      expect(storedUtcMs).toBeGreaterThanOrEqual(beforeMs - 5000);
      expect(storedUtcMs).toBeLessThanOrEqual(afterMs + 5000);

      // Portfolio after order
      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);

      const portfolio = portfolioRes.body as PortfolioResponseBody;
      expect(portfolio.availableCash).toBe('743741.50');
      const pamp = portfolio.positions.find((p) => p.ticker === 'PAMP');
      expect(pamp?.quantity).toBe(50);
    });

    it('CA2: SELL MARKET 10 PAMP for user 1 returns 201 FILLED and updates portfolio (cash "762258.50", PAMP 30)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'SELL',
          type: 'MARKET',
          size: 10,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('FILLED');
      expect(body.price).toBe('925.85');
      expect(body.size).toBe(10);
      expect(body.rejectionReason).toBeNull();

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);

      const portfolio = portfolioRes.body as PortfolioResponseBody;
      expect(portfolio.availableCash).toBe('762258.50');
      const pamp = portfolio.positions.find((p) => p.ticker === 'PAMP');
      expect(pamp?.quantity).toBe(30);
    });

    it('CA3: BUY LIMIT 5 PAMP at 900 for user 1 returns 201 NEW with price "900.00" and leaves portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
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

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('NEW');
      expect(body.price).toBe('900.00');
      expect(body.size).toBe(5);
      expect(body.rejectionReason).toBeNull();

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);

      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA4: SELL LIMIT 5 PAMP at 950.50 for user 1 returns 201 NEW with price "950.50" and leaves portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'SELL',
          type: 'LIMIT',
          size: 5,
          price: 950.5,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('NEW');
      expect(body.price).toBe('950.50');
      expect(body.size).toBe(5);
      expect(body.rejectionReason).toBeNull();

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);

      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA5: BUY MARKET by amount 50000 in PAMP for user 1 returns 201 FILLED with size 54', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          amount: 50000,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('FILLED');
      expect(body.size).toBe(54);
      expect(body.price).toBe('925.85');
      expect(body.rejectionReason).toBeNull();
    });

    it('CA6: BUY LIMIT by amount 50000 in PAMP at 900 for user 1 returns 201 NEW with size 55', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          amount: 50000,
          price: 900,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('NEW');
      expect(body.size).toBe(55);
      expect(body.price).toBe('900.00');
      expect(body.rejectionReason).toBeNull();
    });

    it('CA7: BUY MARKET 813 PAMP (752716.05 pesos) for user 1 returns 201 FILLED', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 813,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('FILLED');
      expect(body.size).toBe(813);
      expect(body.price).toBe('925.85');
      expect(body.rejectionReason).toBeNull();
    });

    it('CA8: SELL MARKET 40 PAMP for user 1 returns 201 FILLED and removes PAMP from portfolio positions', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'SELL',
          type: 'MARKET',
          size: 40,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('FILLED');
      expect(body.size).toBe(40);
      expect(body.rejectionReason).toBeNull();

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);

      const portfolio = portfolioRes.body as PortfolioResponseBody;
      expect(portfolio.positions.some((p) => p.ticker === 'PAMP')).toBe(false);
    });

    it('CA9: BUY LIMIT 1 share at 100 on an instrument without market data (queried dynamically) returns 201 NEW', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: unpricedInstrumentId,
          side: 'BUY',
          type: 'LIMIT',
          size: 1,
          price: 100,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('NEW');
      expect(body.instrumentId).toBe(unpricedInstrumentId);
      expect(body.size).toBe(1);
      expect(body.price).toBe('100.00');
      expect(body.rejectionReason).toBeNull();
    });
  });

  describe('Rejected orders (CA10-CA17) and persistence check (CA28)', () => {
    it('CA10 & CA28: BUY MARKET 814 PAMP (753641.90 pesos) for user 1 returns 201 REJECTED (INSUFFICIENT_FUNDS), persists in orders, and leaves portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 814,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('INSUFFICIENT_FUNDS');
      expect(body.size).toBe(814);
      expect(body.price).toBe('925.85');

      // CA28: Verify REJECTED order exists in orders table
      const dbRows: Array<{ id: number; status: string; size: number }> =
        await dataSource.query(
          `SELECT id, status, size FROM orders WHERE id = $1`,
          [body.id],
        );
      expect(dbRows).toEqual([{ id: body.id, status: 'REJECTED', size: 814 }]);

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA11: BUY LIMIT 1000 PAMP at 900 for user 1 returns 201 REJECTED with INSUFFICIENT_FUNDS and price "900.00", leaving portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          size: 1000,
          price: 900,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('INSUFFICIENT_FUNDS');
      expect(body.price).toBe('900.00');
      expect(body.size).toBe(1000);

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA12: BUY MARKET by amount 1000000 in PAMP for user 1 returns 201 REJECTED with INSUFFICIENT_FUNDS and size 1080, leaving portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          amount: 1000000,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('INSUFFICIENT_FUNDS');
      expect(body.size).toBe(1080);

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA13: BUY MARKET 1 PAMP for user 2 (no cash) returns 201 REJECTED with INSUFFICIENT_FUNDS, leaving user 2 portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 2,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('INSUFFICIENT_FUNDS');

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/2/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual({
        userId: 2,
        totalAccountValue: '0.00',
        availableCash: '0.00',
        positions: [],
      });
    });

    it('CA14: SELL MARKET 41 PAMP for user 1 returns 201 REJECTED with INSUFFICIENT_SHARES, leaving portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'SELL',
          type: 'MARKET',
          size: 41,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('INSUFFICIENT_SHARES');

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA15: SELL MARKET 1 BMA (holding -10) for user 1 returns 201 REJECTED with INSUFFICIENT_SHARES, leaving portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 31,
          side: 'SELL',
          type: 'MARKET',
          size: 1,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('INSUFFICIENT_SHARES');

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA16: SELL MARKET 1 LOMA (no holding) for user 1 returns 201 REJECTED with INSUFFICIENT_SHARES, leaving portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 45,
          side: 'SELL',
          type: 'MARKET',
          size: 1,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('INSUFFICIENT_SHARES');

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });

    it('CA17: BUY MARKET by amount 500 in PAMP for user 1 returns 201 REJECTED with AMOUNT_BELOW_PRICE and size 0, leaving portfolio unchanged', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          amount: 500,
        })
        .expect(201);

      const body = res.body as OrderResponseBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectionReason).toBe('AMOUNT_BELOW_PRICE');
      expect(body.size).toBe(0);

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/1/portfolio')
        .expect(200);
      expect(portfolioRes.body).toEqual(USER_1_INITIAL_PORTFOLIO);
    });
  });

  describe('Validation and domain errors (CA18-CA26) do not persist orders', () => {
    it.each([
      {
        label: 'missing userId',
        payload: { instrumentId: 47, side: 'BUY', type: 'MARKET', size: 10 },
      },
      {
        label: 'missing instrumentId',
        payload: { userId: 1, side: 'BUY', type: 'MARKET', size: 10 },
      },
      {
        label: 'missing side',
        payload: { userId: 1, instrumentId: 47, type: 'MARKET', size: 10 },
      },
      {
        label: 'missing type',
        payload: { userId: 1, instrumentId: 47, side: 'BUY', size: 10 },
      },
    ])(
      'CA18: returns 400 and does not persist when $label',
      async ({ payload }) => {
        await request(app.getHttpServer())
          .post('/v1/orders')
          .send(payload)
          .expect(400);

        expect(await countOrders()).toBe(11);
      },
    );

    it.each([
      {
        label: 'both size and amount provided',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
          amount: 10000,
        },
      },
      {
        label: 'neither size nor amount provided',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
        },
      },
    ])(
      'CA19: returns 400 and does not persist when $label',
      async ({ payload }) => {
        await request(app.getHttpServer())
          .post('/v1/orders')
          .send(payload)
          .expect(400);

        expect(await countOrders()).toBe(11);
      },
    );

    it.each([
      {
        label: 'LIMIT without price',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          size: 10,
        },
      },
      {
        label: 'MARKET with price',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
          price: 900,
        },
      },
    ])(
      'CA20: returns 400 and does not persist when $label',
      async ({ payload }) => {
        await request(app.getHttpServer())
          .post('/v1/orders')
          .send(payload)
          .expect(400);

        expect(await countOrders()).toBe(11);
      },
    );

    it.each([
      {
        label: 'size = 0',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 0,
        },
      },
      {
        label: 'size = -5',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: -5,
        },
      },
      {
        label: 'size = 1.5',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 1.5,
        },
      },
      {
        label: 'amount = 0',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          amount: 0,
        },
      },
      {
        label: 'amount = -100',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          amount: -100,
        },
      },
      {
        label: 'amount with 3 decimal places',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          amount: 100.123,
        },
      },
      {
        label: 'price = 0',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          size: 10,
          price: 0,
        },
      },
      {
        label: 'price = -10',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          size: 10,
          price: -10,
        },
      },
      {
        label: 'userId = 99999999999',
        payload: {
          userId: 99999999999,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
        },
      },
      {
        label: 'instrumentId = 99999999999',
        payload: {
          userId: 1,
          instrumentId: 99999999999,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
        },
      },
      {
        label: 'size = 3000000000',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 3000000000,
        },
      },
      {
        label: 'price = 100000000',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          size: 10,
          price: 100000000,
        },
      },
      {
        label: 'amount = 1e15',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          amount: 1e15,
        },
      },
    ])(
      'CA21: returns 400 and does not persist for invalid number ($label)',
      async ({ payload }) => {
        await request(app.getHttpServer())
          .post('/v1/orders')
          .send(payload)
          .expect(400);

        expect(await countOrders()).toBe(11);
      },
    );

    it('CA21b: returns 400 ORDER_SIZE_TOO_LARGE and does not persist when amount with low price yields size > 2147483647', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          amount: 30000000,
          price: 0.01,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        code: 'ORDER_SIZE_TOO_LARGE',
      });
      expect(await countOrders()).toBe(11);
    });

    it.each([
      {
        label: 'side CASH_IN',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'CASH_IN',
          type: 'MARKET',
          size: 10,
        },
      },
      {
        label: 'type STOP',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'STOP',
          size: 10,
        },
      },
      {
        label: 'unknown field foo',
        payload: {
          userId: 1,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
          foo: 'bar',
        },
      },
    ])(
      'CA22: returns 400 and does not persist for invalid enum or unknown field ($label)',
      async ({ payload }) => {
        await request(app.getHttpServer())
          .post('/v1/orders')
          .send(payload)
          .expect(400);

        expect(await countOrders()).toBe(11);
      },
    );

    it('CA23: returns 404 USER_NOT_FOUND for userId 999 and does not persist', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 999,
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
        })
        .expect(404);

      expect(res.body).toEqual({
        code: 'USER_NOT_FOUND',
        message: 'User 999 was not found',
      });
      expect(await countOrders()).toBe(11);
    });

    it('CA24: returns 404 INSTRUMENT_NOT_FOUND for instrumentId 9999 and does not persist', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 9999,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
        })
        .expect(404);

      expect(res.body).toEqual({
        code: 'INSTRUMENT_NOT_FOUND',
        message: 'Instrument 9999 was not found',
      });
      expect(await countOrders()).toBe(11);
    });

    it('CA25: returns 400 INSTRUMENT_NOT_TRADABLE for instrumentId 66 (ARS) and does not persist', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: 66,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
        })
        .expect(400);

      expect(res.body).toEqual({
        code: 'INSTRUMENT_NOT_TRADABLE',
        message: 'Instrument 66 is not tradable',
      });
      expect(await countOrders()).toBe(11);
    });

    it('CA26: returns 422 MARKET_PRICE_UNAVAILABLE for MARKET order on instrument without market data and does not persist', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({
          userId: 1,
          instrumentId: unpricedInstrumentId,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
        })
        .expect(422);

      expect(res.body).toEqual({
        code: 'MARKET_PRICE_UNAVAILABLE',
        message: `Market price is unavailable for instrument ${unpricedInstrumentId}`,
      });
      expect(await countOrders()).toBe(11);
    });
  });

  describe('Concurrency (CA29)', () => {
    it('CA29: with CASH_IN 10000 for user 2 and 5 simultaneous BUY MARKET 10 PAMP requests via Promise.all, approves exactly 1 FILLED and 4 REJECTED (INSUFFICIENT_FUNDS), leaving cash "741.50"', async () => {
      await insertTestOrders(dataSource, [
        {
          userId: 2,
          instrumentId: 66,
          size: 10000,
          price: '1.00',
          side: 'CASH_IN',
          status: 'FILLED',
        },
      ]);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer()).post('/v1/orders').send({
            userId: 2,
            instrumentId: 47,
            side: 'BUY',
            type: 'MARKET',
            size: 10,
          }),
        ),
      );

      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      const bodies = responses.map((res) => res.body as OrderResponseBody);
      const filled = bodies.filter((b) => b.status === 'FILLED');
      const rejected = bodies.filter((b) => b.status === 'REJECTED');

      expect(filled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect(r.rejectionReason).toBe('INSUFFICIENT_FUNDS');
      }

      const portfolioRes = await request(app.getHttpServer())
        .get('/v1/users/2/portfolio')
        .expect(200);

      const portfolio = portfolioRes.body as PortfolioResponseBody;
      expect(portfolio.availableCash).toBe('741.50');
    });

    it('leaves the orders table with its original 11 rows after cleanup', async () => {
      expect(await countOrders()).toBe(11);
    });
  });
});
