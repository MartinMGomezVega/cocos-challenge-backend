import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from 'decimal.js';
import { DataSource } from 'typeorm';
import { Instrument } from '../../domain/instruments/instrument';
import { DatabaseModule } from '../database/database.module';
import { TypeOrmInstrumentRepository } from './typeorm-instrument.repository';

describe('TypeOrmInstrumentRepository (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: TypeOrmInstrumentRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [TypeOrmInstrumentRepository],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    repository = moduleRef.get(TypeOrmInstrumentRepository);
  });

  afterAll(async () => {
    if (moduleRef) {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
      await moduleRef.close();
    }
  });

  it('matches by ticker case-insensitively and returns the latest date marketPrice for PAMP (close 925.85 from 2023-07-14, not 921.80)', async () => {
    const lower = await repository.search({
      query: 'pamp',
      page: 1,
      limit: 20,
    });
    const mixed = await repository.search({
      query: 'PaMp',
      page: 1,
      limit: 20,
    });

    expect(lower.total).toBe(1);
    expect(lower.items).toHaveLength(1);
    expect(lower.items[0]).toBeInstanceOf(Instrument);
    expect(lower.items[0].id).toBe(47);
    expect(lower.items[0].ticker).toBe('PAMP');
    expect(lower.items[0].marketPrice?.close).toEqual(new Decimal('925.85'));
    expect(lower.items[0].marketPrice?.previousClose).toEqual(
      new Decimal('921.80'),
    );
    expect(mixed).toEqual(lower);
  });

  it('matches by name case-insensitively (e.g., "macro" -> BMA)', async () => {
    const result = await repository.search({
      query: 'macro',
      page: 1,
      limit: 20,
    });

    const bma = result.items.find((item) => item.id === 31);
    expect(bma).toBeDefined();
    expect(bma?.ticker).toBe('BMA');
    expect(bma?.marketPrice?.close).toEqual(new Decimal('1502.80'));
    expect(bma?.marketPrice?.previousClose).toEqual(new Decimal('1520.25'));
  });

  it('excludes MONEDA (ARS, id 66) and orders by ticker ASC, id ASC with pagination and total', async () => {
    const page1 = await repository.search({ page: 1, limit: 20 });
    const page4 = await repository.search({ page: 4, limit: 20 });
    const all = await repository.search({ page: 1, limit: 100 });

    expect(page1.total).toBe(65);
    expect(page1.items).toHaveLength(20);
    expect(page4.total).toBe(65);
    expect(page4.items).toHaveLength(5);

    expect(all.total).toBe(65);
    expect(all.items).toHaveLength(65);
    expect(
      all.items.some((item) => item.type === 'MONEDA' || item.id === 66),
    ).toBe(false);

    const tickers = all.items.map((item) => item.ticker);
    const sortedTickers = [...tickers].sort((a, b) => a.localeCompare(b));
    expect(tickers).toEqual(sortedTickers);
  });

  it('escapes SQL wildcards "%", "_" and "\\": searching "%" or "_" does not return all instruments', async () => {
    const percentResult = await repository.search({
      query: '%',
      page: 1,
      limit: 100,
    });
    expect(percentResult.total).toBe(0);
    expect(percentResult.items).toEqual([]);

    const underscoreResult = await repository.search({
      query: '_',
      page: 1,
      limit: 100,
    });
    expect(underscoreResult.total).toBe(0);
    expect(underscoreResult.items).toEqual([]);

    const backslashResult = await repository.search({
      query: '\\',
      page: 1,
      limit: 100,
    });
    expect(backslashResult.total).toBe(0);
    expect(backslashResult.items).toEqual([]);
  });

  it('returns marketPrice = null for instruments without marketdata (identified dynamically via SQL)', async () => {
    const rowsWithoutMarketData: Array<{ id: number }> = await dataSource.query(
      `SELECT i.id
       FROM instruments i
       LEFT JOIN marketdata m ON m.instrumentid = i.id
       WHERE i.type <> 'MONEDA' AND m.id IS NULL
       ORDER BY i.id ASC`,
    );

    expect(rowsWithoutMarketData.length).toBeGreaterThan(0);

    const all = await repository.search({ page: 1, limit: 100 });
    const expectedIds = rowsWithoutMarketData.map((r) => r.id);

    for (const id of expectedIds) {
      const found = all.items.find((item) => item.id === id);
      expect(found).toBeDefined();
      expect(found?.marketPrice).toBeNull();
    }

    const itemsWithNullPrice = all.items
      .filter((item) => item.marketPrice === null)
      .map((item) => item.id)
      .sort((a, b) => a - b);

    expect(itemsWithNullPrice).toEqual(expectedIds);
  });

  it('maps previousClose as null when latest marketdata has close present and previousclose NULL', async () => {
    const rowsWithoutMarketData: Array<{ id: number; ticker: string }> =
      await dataSource.query(
        `SELECT i.id, i.ticker
         FROM instruments i
         LEFT JOIN marketdata m ON m.instrumentid = i.id
         WHERE i.type <> 'MONEDA' AND m.id IS NULL
         ORDER BY i.id ASC
         LIMIT 1`,
      );

    const target = rowsWithoutMarketData[0];
    expect(target).toBeDefined();

    const insertedRows: Array<{ id: number }> = await dataSource.query(
      `INSERT INTO marketdata (instrumentid, high, low, open, close, previousclose, date)
       VALUES ($1, NULL, NULL, NULL, 150.25, NULL, '2023-07-14')
       RETURNING id`,
      [target.id],
    );
    const insertedId = insertedRows[0].id;

    try {
      const result = await repository.search({
        query: target.ticker,
        page: 1,
        limit: 20,
      });

      const found = result.items.find((item) => item.id === target.id);
      expect(found).toBeDefined();
      expect(found?.marketPrice).not.toBeNull();
      expect(found?.marketPrice?.close).toEqual(new Decimal('150.25'));
      expect(found?.marketPrice?.previousClose).toBeNull();
      expect(found?.marketPrice?.dailyReturn()).toBeNull();
    } finally {
      await dataSource.query(`DELETE FROM marketdata WHERE id = $1`, [
        insertedId,
      ]);
    }
  });

  describe('findByIds', () => {
    it('returns matching instruments with their latest marketPrice', async () => {
      const instruments = await repository.findByIds([31, 47, 54]);

      expect(instruments).toHaveLength(3);
      expect(instruments.every((inst) => inst instanceof Instrument)).toBe(
        true,
      );

      const bma = instruments.find((i) => i.id === 31);
      expect(bma?.ticker).toBe('BMA');
      expect(bma?.marketPrice?.close).toEqual(new Decimal('1502.80'));
      expect(bma?.marketPrice?.previousClose).toEqual(new Decimal('1520.25'));

      const pamp = instruments.find((i) => i.id === 47);
      expect(pamp?.ticker).toBe('PAMP');
      expect(pamp?.marketPrice?.close).toEqual(new Decimal('925.85'));
      expect(pamp?.marketPrice?.previousClose).toEqual(new Decimal('921.80'));

      const metr = instruments.find((i) => i.id === 54);
      expect(metr?.ticker).toBe('METR');
      expect(metr?.marketPrice?.close).toEqual(new Decimal('229.50'));
      expect(metr?.marketPrice?.previousClose).toEqual(new Decimal('232.00'));
    });

    it('returns empty array and does not query the database when ids is empty', async () => {
      const querySpy = jest.spyOn(dataSource, 'query');
      querySpy.mockClear();

      try {
        const result = await repository.findByIds([]);
        expect(result).toEqual([]);
        expect(querySpy).not.toHaveBeenCalled();
      } finally {
        querySpy.mockRestore();
      }
    });
  });
});
