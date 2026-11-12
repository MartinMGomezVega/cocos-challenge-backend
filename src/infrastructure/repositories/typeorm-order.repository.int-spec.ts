import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from 'decimal.js';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

describe('TypeOrmOrderRepository (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: TypeOrmOrderRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [TypeOrmOrderRepository],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    repository = moduleRef.get(TypeOrmOrderRepository);
  });

  afterAll(async () => {
    if (moduleRef) {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
      await moduleRef.close();
    }
  });

  it('returns the exact 7 FILLED movements for user 1 (orders 1, 2, 4, 8, 9, 10 and 11) as AccountMovement domain objects', async () => {
    const movements = await repository.findFilledMovementsByUser(1);

    expect(movements).toEqual([
      {
        instrumentId: 66,
        side: 'CASH_IN',
        size: 1000000,
        price: new Decimal('1.00'),
      },
      {
        instrumentId: 47,
        side: 'BUY',
        size: 50,
        price: new Decimal('930.00'),
      },
      {
        instrumentId: 47,
        side: 'SELL',
        size: 10,
        price: new Decimal('940.00'),
      },
      {
        instrumentId: 66,
        side: 'CASH_OUT',
        size: 100000,
        price: new Decimal('1.00'),
      },
      {
        instrumentId: 31,
        side: 'BUY',
        size: 20,
        price: new Decimal('1540.00'),
      },
      {
        instrumentId: 54,
        side: 'BUY',
        size: 500,
        price: new Decimal('250.00'),
      },
      {
        instrumentId: 31,
        side: 'SELL',
        size: 30,
        price: new Decimal('1530.00'),
      },
    ]);
  });

  it('returns an empty list for a user without orders (e.g. user 2)', async () => {
    const movements = await repository.findFilledMovementsByUser(2);
    expect(movements).toEqual([]);
  });

  it('ignores FILLED rows with size or price in NULL', async () => {
    const inserted: Array<{ id: number }> = await dataSource.query(
      `INSERT INTO orders (instrumentid, userid, size, price, type, side, status, datetime)
       VALUES (47, 2, NULL, 900.00, 'MARKET', 'BUY', 'FILLED', NOW()),
              (47, 2, 10, NULL, 'MARKET', 'BUY', 'FILLED', NOW())
       RETURNING id`,
    );

    try {
      const movements = await repository.findFilledMovementsByUser(2);
      expect(movements).toEqual([]);
    } finally {
      await dataSource.query(`DELETE FROM orders WHERE id = ANY($1::int[])`, [
        inserted.map((r) => r.id),
      ]);
    }
  });
});
