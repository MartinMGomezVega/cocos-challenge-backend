import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { closeTestApp, createTestApp } from '../support/test-app';

interface InstrumentDtoItem {
  id: number;
  ticker: string;
  name: string;
  type: string;
  lastPrice: string | null;
  dailyReturnPct: string | null;
}

interface SearchInstrumentsResponseBody {
  data: InstrumentDtoItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

describe('GET /v1/instruments (CA1-CA12)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    if (app) {
      await closeTestApp(app);
    }
  });

  it('CA1: ?query=pamp returns 1 result (id 47, lastPrice "925.85", dailyReturnPct "0.44", total 1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ query: 'pamp' })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body).toEqual({
      data: [
        {
          id: 47,
          ticker: 'PAMP',
          name: 'Pampa Holding S.A.',
          type: 'ACCIONES',
          lastPrice: '925.85',
          dailyReturnPct: '0.44',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('CA2: ?query=PaMp returns the same result as CA1 (case-insensitive)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ query: 'PaMp' })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(47);
    expect(body.data[0].lastPrice).toBe('925.85');
    expect(body.data[0].dailyReturnPct).toBe('0.44');
    expect(body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('CA3: ?query=macro includes BMA (id 31) with lastPrice "1502.80" and dailyReturnPct "-1.15"', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ query: 'macro' })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    const bma = body.data.find((item) => item.id === 31);
    expect(bma).toEqual({
      id: 31,
      ticker: 'BMA',
      name: 'Banco Macro S.A.',
      type: 'ACCIONES',
      lastPrice: '1502.80',
      dailyReturnPct: '-1.15',
    });
  });

  it('CA4: ?query=metr includes METR (id 54) with lastPrice "229.50" and dailyReturnPct "-1.08"', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ query: 'metr' })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    const metr = body.data.find((item) => item.id === 54);
    expect(metr).toEqual({
      id: 54,
      ticker: 'METR',
      name: 'MetroGAS S.A.',
      type: 'ACCIONES',
      lastPrice: '229.50',
      dailyReturnPct: '-1.08',
    });
  });

  it('CA5: without parameters returns 20 results ordered by ticker, total 65, totalPages 4 (and empty/whitespace query behaves identically)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body.data).toHaveLength(20);
    expect(body.meta).toEqual({ page: 1, limit: 20, total: 65, totalPages: 4 });

    const tickers = body.data.map((i) => i.ticker);
    const sorted = [...tickers].sort((a, b) => a.localeCompare(b));
    expect(tickers).toEqual(sorted);

    const resSpaces = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ query: '   ' })
      .expect(200);
    expect(resSpaces.body).toEqual(body);
  });

  it('CA6: ?page=4 returns 5 results', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ page: 4 })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body.data).toHaveLength(5);
    expect(body.meta).toEqual({ page: 4, limit: 20, total: 65, totalPages: 4 });
  });

  it('CA7: ?page=5 returns data: [] and total 65', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ page: 5 })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body.data).toEqual([]);
    expect(body.meta).toEqual({ page: 5, limit: 20, total: 65, totalPages: 4 });
  });

  it('CA8: ?limit=100 returns 65 results, none of type MONEDA or with id 66', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ limit: 100 })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body.data).toHaveLength(65);
    expect(
      body.data.some((item) => item.type === 'MONEDA' || item.id === 66),
    ).toBe(false);
  });

  it('CA9: ?query=zzzzzz returns data: [], total 0, totalPages 0', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ query: 'zzzzzz' })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('CA10: ?query=% returns data: [] (% does not act as wildcard)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ query: '%' })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('CA11: ?limit=100 includes the 2 instruments without market data with lastPrice and dailyReturnPct as null', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/instruments')
      .query({ limit: 100 })
      .expect(200);

    const body = res.body as SearchInstrumentsResponseBody;
    const withoutMarketData = body.data.filter(
      (item) => item.lastPrice === null && item.dailyReturnPct === null,
    );
    expect(withoutMarketData).toHaveLength(2);
  });

  it.each([
    { label: '?page=0', query: { page: '0' } },
    { label: '?page=1e18', query: { page: '1e18' } },
    { label: '?limit=101', query: { limit: '101' } },
    { label: '?limit=abc', query: { limit: 'abc' } },
    { label: '?foo=1', query: { foo: '1' } },
    { label: 'query of 51 chars', query: { query: 'a'.repeat(51) } },
  ])('CA12: returns 400 for invalid parameter ($label)', async ({ query }) => {
    await request(app.getHttpServer())
      .get('/v1/instruments')
      .query(query)
      .expect(400);
  });
});
