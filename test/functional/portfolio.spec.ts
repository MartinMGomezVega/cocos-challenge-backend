import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { cleanupTestOrders, insertTestOrders } from '../support/order-fixtures';
import { closeTestApp, createTestApp } from '../support/test-app';

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

describe('GET /v1/users/:userId/portfolio (CA1-CA10)', () => {
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
    if (dataSource && dataSource.isInitialized) {
      const rows: Array<{ count: string }> = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM orders`,
      );
      expect(Number(rows[0].count)).toBe(11);
    }
    if (app) {
      await closeTestApp(app);
    }
  });

  it('CA1: returns complete portfolio for user 1 with availableCash "753000.00", totalAccountValue "889756.00", and positions ordered BMA, METR, PAMP', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/1/portfolio')
      .expect(200);

    expect(res.body).toEqual({
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
    });
  });

  it('CA2: returns user 1 BMA position with quantity -10, marketValue "-15028.00", totalReturnPct null, dailyReturnPct "-1.15"', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/1/portfolio')
      .expect(200);

    const body = res.body as PortfolioResponseBody;
    const bma = body.positions.find((p) => p.ticker === 'BMA');
    expect(bma).toEqual({
      instrumentId: 31,
      ticker: 'BMA',
      name: 'Banco Macro S.A.',
      quantity: -10,
      marketValue: '-15028.00',
      totalReturnPct: null,
      dailyReturnPct: '-1.15',
    });
  });

  it('CA3: returns user 1 METR position with quantity 500, marketValue "114750.00", totalReturnPct "-8.20", dailyReturnPct "-1.08"', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/1/portfolio')
      .expect(200);

    const body = res.body as PortfolioResponseBody;
    const metr = body.positions.find((p) => p.ticker === 'METR');
    expect(metr).toEqual({
      instrumentId: 54,
      ticker: 'METR',
      name: 'MetroGAS S.A.',
      quantity: 500,
      marketValue: '114750.00',
      totalReturnPct: '-8.20',
      dailyReturnPct: '-1.08',
    });
  });

  it('CA4: returns user 1 PAMP position with quantity 40, marketValue "37034.00", totalReturnPct "-0.45", dailyReturnPct "0.44"', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/1/portfolio')
      .expect(200);

    const body = res.body as PortfolioResponseBody;
    const pamp = body.positions.find((p) => p.ticker === 'PAMP');
    expect(pamp).toEqual({
      instrumentId: 47,
      ticker: 'PAMP',
      name: 'Pampa Holding S.A.',
      quantity: 40,
      marketValue: '37034.00',
      totalReturnPct: '-0.45',
      dailyReturnPct: '0.44',
    });
  });

  it('CA5: does not list LOMA (id 45) for user 1 because its only order is NEW', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/1/portfolio')
      .expect(200);

    const body = res.body as PortfolioResponseBody;
    expect(
      body.positions.some((p) => p.instrumentId === 45 || p.ticker === 'LOMA'),
    ).toBe(false);
  });

  it.each([2, 3, 4])(
    'CA6: returns availableCash "0.00", totalAccountValue "0.00" and empty positions for user %i',
    async (userId) => {
      const res = await request(app.getHttpServer())
        .get(`/v1/users/${userId}/portfolio`)
        .expect(200);

      expect(res.body).toEqual({
        userId,
        totalAccountValue: '0.00',
        availableCash: '0.00',
        positions: [],
      });
    },
  );

  it('CA7: returns 404 with code USER_NOT_FOUND for non-existent user 999', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/999/portfolio')
      .expect(404);

    expect(res.body).toEqual({
      code: 'USER_NOT_FOUND',
      message: 'User 999 was not found',
    });
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])(
    'CA8: returns 400 for invalid userId "%s"',
    async (invalidUserId) => {
      await request(app.getHttpServer())
        .get(`/v1/users/${invalidUserId}/portfolio`)
        .expect(400);
    },
  );

  it('CA9: calculates portfolio for user 2 with CASH_IN 100000 and BUY 10 PAMP @ 900 FILLED', async () => {
    await insertTestOrders(dataSource, [
      {
        userId: 2,
        instrumentId: 66,
        size: 100000,
        price: '1.00',
        side: 'CASH_IN',
        status: 'FILLED',
      },
      {
        userId: 2,
        instrumentId: 47,
        size: 10,
        price: '900.00',
        side: 'BUY',
        status: 'FILLED',
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/v1/users/2/portfolio')
      .expect(200);

    expect(res.body).toEqual({
      userId: 2,
      totalAccountValue: '100258.50',
      availableCash: '91000.00',
      positions: [
        {
          instrumentId: 47,
          ticker: 'PAMP',
          name: 'Pampa Holding S.A.',
          quantity: 10,
          marketValue: '9258.50',
          totalReturnPct: '2.87',
          dailyReturnPct: '0.44',
        },
      ],
    });
  });

  it('CA10: excludes position and updates cash when user 2 sells all 10 PAMP @ 950 FILLED', async () => {
    await insertTestOrders(dataSource, [
      {
        userId: 2,
        instrumentId: 66,
        size: 100000,
        price: '1.00',
        side: 'CASH_IN',
        status: 'FILLED',
      },
      {
        userId: 2,
        instrumentId: 47,
        size: 10,
        price: '900.00',
        side: 'BUY',
        status: 'FILLED',
      },
      {
        userId: 2,
        instrumentId: 47,
        size: 10,
        price: '950.00',
        side: 'SELL',
        status: 'FILLED',
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/v1/users/2/portfolio')
      .expect(200);

    expect(res.body).toEqual({
      userId: 2,
      totalAccountValue: '100500.00',
      availableCash: '100500.00',
      positions: [],
    });
  });

  it('leaves the orders table with its original 11 rows after cleanup', async () => {
    const rows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*)::text AS count FROM orders`,
    );
    expect(Number(rows[0].count)).toBe(11);
  });
});
