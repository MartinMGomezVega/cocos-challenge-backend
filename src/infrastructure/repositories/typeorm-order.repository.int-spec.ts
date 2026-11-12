import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from 'decimal.js';
import { DataSource } from 'typeorm';
import {
  cleanupTestOrders,
  insertTestOrders,
} from '../../../test/support/order-fixtures';
import { decideOrder } from '../../domain/orders/order-decision';
import { AccountMovement } from '../../domain/portfolio/account-movement';
import { DomainError } from '../../domain/shared/domain-error';
import { DatabaseModule } from '../database/database.module';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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
    await cleanupTestOrders(dataSource);
  });

  afterEach(async () => {
    await cleanupTestOrders(dataSource);
  });

  afterAll(async () => {
    if (moduleRef) {
      if (dataSource && dataSource.isInitialized) {
        await cleanupTestOrders(dataSource);
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
    await dataSource.query(
      `INSERT INTO orders (instrumentid, userid, size, price, type, side, status, datetime)
       VALUES (47, 2, NULL, 900.00, 'MARKET', 'BUY', 'FILLED', NOW()),
              (47, 2, 10, NULL, 'MARKET', 'BUY', 'FILLED', NOW())`,
    );

    const movements = await repository.findFilledMovementsByUser(2);
    expect(movements).toEqual([]);
  });

  describe('submitAtomically', () => {
    it('inserts the decided order and returns it with its generated id', async () => {
      const order = await repository.submitAtomically(1, (movements) => {
        const decision = decideOrder({
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
          marketPrice: new Decimal('925.85'),
          movements,
        });
        return {
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          ...decision,
        };
      });

      expect(order.id).toBeGreaterThan(11);
      expect(order.userId).toBe(1);
      expect(order.instrumentId).toBe(47);
      expect(order.side).toBe('BUY');
      expect(order.type).toBe('MARKET');
      expect(order.size).toBe(10);
      expect(order.price).toEqual(new Decimal('925.85'));
      expect(order.status).toBe('FILLED');
      expect(order.rejectionReason).toBeNull();
      expect(order.datetime).toBeInstanceOf(Date);

      const savedRows: Array<{
        id: number;
        userid: number;
        instrumentid: number;
        size: number;
        price: string;
        type: string;
        side: string;
        status: string;
      }> = await dataSource.query(
        `SELECT id, userid, instrumentid, size, price, type, side, status
         FROM orders
         WHERE id = $1`,
        [order.id],
      );

      expect(savedRows).toEqual([
        {
          id: order.id,
          userid: 1,
          instrumentid: 47,
          size: 10,
          price: '925.85',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
        },
      ]);
    });

    it('throws USER_NOT_FOUND when the user row does not exist', async () => {
      await expect(
        repository.submitAtomically(999, () => ({
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
          price: new Decimal('925.85'),
          status: 'FILLED',
          rejectionReason: null,
        })),
      ).rejects.toMatchObject({
        kind: 'NOT_FOUND',
        code: 'USER_NOT_FOUND',
      });
    });

    it('rolls back the transaction and leaves no inserted row when decide throws an error', async () => {
      await expect(
        repository.submitAtomically(1, () => {
          throw new DomainError(
            'MARKET_PRICE_UNAVAILABLE',
            'No market price',
            'UNPROCESSABLE',
          );
        }),
      ).rejects.toThrow(DomainError);

      const countRows: Array<{ count: string }> = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM orders`,
      );
      expect(Number(countRows[0].count)).toBe(11);
    });

    it('persists datetime explicitly in UTC (compared as raw text against current UTC time)', async () => {
      const beforeMs = Date.now();

      const order = await repository.submitAtomically(1, () => ({
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        size: 5,
        price: new Decimal('900.00'),
        status: 'NEW',
        rejectionReason: null,
      }));

      const afterMs = Date.now();

      const rows: Array<{ raw_datetime: string }> = await dataSource.query(
        `SELECT to_char(datetime, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS raw_datetime
         FROM orders
         WHERE id = $1`,
        [order.id],
      );

      const storedUtcMs = Date.parse(rows[0].raw_datetime);
      expect(storedUtcMs).toBeGreaterThanOrEqual(beforeMs - 5000);
      expect(storedUtcMs).toBeLessThanOrEqual(afterMs + 5000);
      expect(Math.abs(order.datetime.getTime() - storedUtcMs)).toBeLessThan(10);
    });

    it('serializes concurrent calls for the same user via FOR UPDATE lock so the second call sees the first FILLED order', async () => {
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

      const firstEnteredLock = createDeferred();
      const releaseFirst = createDeferred();
      let secondDecideRan = false;
      let secondSeenMovements: AccountMovement[] = [];

      const firstPromise = repository.submitAtomically(2, async (movements) => {
        firstEnteredLock.resolve();
        await releaseFirst.promise;
        const decision = decideOrder({
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
          marketPrice: new Decimal('925.85'),
          movements,
        });
        return {
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          ...decision,
        };
      });

      await firstEnteredLock.promise;

      const secondPromise = repository.submitAtomically(2, (movements) => {
        secondDecideRan = true;
        secondSeenMovements = movements;
        const decision = decideOrder({
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          size: 10,
          marketPrice: new Decimal('925.85'),
          movements,
        });
        return {
          instrumentId: 47,
          side: 'BUY',
          type: 'MARKET',
          ...decision,
        };
      });

      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(secondDecideRan).toBe(false);

      releaseFirst.resolve();

      const [firstOrder, secondOrder] = await Promise.all([
        firstPromise,
        secondPromise,
      ]);

      expect(secondDecideRan).toBe(true);
      expect(firstOrder.status).toBe('FILLED');
      expect(secondOrder.status).toBe('REJECTED');
      expect(secondOrder.rejectionReason).toBe('INSUFFICIENT_FUNDS');
      expect(secondSeenMovements).toHaveLength(2);
      expect(secondSeenMovements[1]).toEqual({
        instrumentId: 47,
        side: 'BUY',
        size: 10,
        price: new Decimal('925.85'),
      });
    });

    it('does not block concurrent calls for different users', async () => {
      const firstEnteredLock = createDeferred();
      const releaseFirst = createDeferred();
      let secondUserFinishedWhileFirstBlocked = false;

      const user2Promise = repository.submitAtomically(2, async () => {
        firstEnteredLock.resolve();
        await releaseFirst.promise;
        return {
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          size: 1,
          price: new Decimal('900.00'),
          status: 'NEW',
          rejectionReason: null,
        };
      });

      await firstEnteredLock.promise;

      const user3Order = await repository.submitAtomically(3, () => ({
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        size: 1,
        price: new Decimal('900.00'),
        status: 'NEW',
        rejectionReason: null,
      }));
      secondUserFinishedWhileFirstBlocked = true;

      expect(secondUserFinishedWhileFirstBlocked).toBe(true);
      expect(user3Order.userId).toBe(3);

      releaseFirst.resolve();
      await user2Promise;
    });
  });
});
